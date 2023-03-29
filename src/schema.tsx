import { hex, isPrintable } from "./hex";

export interface Type {
    parse(view: DataView): TypeInst;
}

interface TypeInstChild {
    name?: string;
    inst: TypeInst;
}
export interface TypeInst {
    type: Type;
    ofs: number;
    len: number;
    render(): string;
    children?: Array<TypeInstChild>;
}

export class Literal implements Type {
    constructor(readonly expected: number, readonly text: boolean) { }
    parse(view: DataView): TypeInst {
        const value = new DataView(view.buffer, view.byteOffset, this.expected);
        return new LiteralInst(this, view.byteOffset, value);
    }
}
class LiteralInst implements TypeInst {
    len = this.type.expected;
    constructor(readonly type: Literal, readonly ofs: number, private value: DataView) { }
    render(): string {
        let buf = [];
        for (let i = 0; i < this.type.expected; i++) {
            const byte = this.value.getUint8(i);
            if (this.type.text) {
                if (isPrintable(byte)) {
                    buf.push(String.fromCharCode(byte));
                } else {
                    switch (byte) {
                        case 0: buf.push('\\0'); break;
                        default: buf.push('\\x' + hex(byte));
                    }
                }
            } else {
                buf.push(hex(byte));
            }
            if (i > 8) {
                buf.push(' [...]');
                break;
            }
        }
        let str = buf.join('');
        if (this.type.text) str = `'${str}'`;
        return str;
    }
}

abstract class Numeric implements Type {
    abstract getNum(view: DataView): number;
    abstract len: number;
    parse(view: DataView): NumericInst {
        const value = this.getNum(view);
        return new NumericInst(this, view.byteOffset, value);
    }
}
class NumericInst implements TypeInst {
    len = this.type.len;
    constructor(readonly type: Numeric, readonly ofs: number, readonly value: number) { }
    render(): string {
        return '0x' + hex(this.value, 0);
    }
}

export class U16 extends Numeric {
    len = 2;
    getNum(view: DataView): number {
        return view.getUint16(0, true);
    }
}

export class U32 extends Numeric {
    len = 4;
    getNum(view: DataView): number {
        return view.getUint32(0, true);
    }
}

export class NumEnum implements Type {
    constructor(readonly num: Numeric, readonly values: { [num: number]: string }) { }
    parse(view: DataView): TypeInst {
        return new NumEnumInst(this, this.num.parse(view));
    }
}
export class NumEnumInst implements TypeInst {
    ofs = this.num.ofs;
    len = this.num.len;
    constructor(readonly type: NumEnum, readonly num: NumericInst) { }
    render(): string {
        const name = this.type.values[this.num.value];
        if (name) {
            return `${name} (${this.num.render()})`;
        }
        return this.num.render();
    }
}

export interface StructField {
    name: string;
    ofs?: string;
    type: Type;
}
export class Struct implements Type {
    constructor(readonly fields: StructField[]) { }
    parse(view: DataView): TypeInst {
        let ofs = 0;
        const insts = [];
        for (const f of this.fields) {
            let fofs = ofs;
            if (f.ofs) {
                fofs = 0x80;  // TODO: expression evaluator
            }
            const inst = f.type.parse(new DataView(view.buffer, view.byteOffset + fofs));
            insts.push({ name: f.name, inst });
            ofs += inst.len;
        }
        return new StructInst(this, view.byteOffset, ofs, insts);
    }
}
class StructInst implements TypeInst {
    constructor(readonly type: Struct, readonly ofs: number, readonly len: number, readonly children: TypeInstChild[]) {
    }
    render(): string {
        return '';
    }
}

export class List implements Type {
    constructor(readonly inner: Type, readonly count: number) { }
    parse(view: DataView): TypeInst {
        let ofs = 0;
        let insts = [];
        for (let i = 0; i < this.count; i++) {
            const inst = this.inner.parse(new DataView(view.buffer, view.byteOffset + ofs));
            insts.push({ inst });
            ofs += inst.len;
        }
        return new ListInst(this, view.byteOffset, insts);
    }
}
class ListInst implements TypeInst {
    len = this.children.length * this.children![0].inst.len;
    constructor(readonly type: List, readonly ofs: number, readonly children: TypeInstChild[]) { }
    render(): string {
        return `${this.children.length} entries`;
    }
}