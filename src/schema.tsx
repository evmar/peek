import { hex } from "./hex";

export interface Type {
    name: string;
    parse(view: DataView): TypeInst;
}

export interface TypeInst {
    type: Type;
    ofs: number;
    len: number;
    render(): string;
    children?: TypeInst[];
}

export class Literal implements Type {
    constructor(readonly name: string, readonly expected: number) { }
    parse(view: DataView): TypeInst {
        const value = new DataView(view.buffer, 0, this.expected);
        return new LiteralInst(this, view.byteOffset, value);
    }
}
class LiteralInst implements TypeInst {
    len = this.type.expected;
    constructor(readonly type: Literal, readonly ofs: number, private value: DataView) { }
    render(): string {
        let buf = [];
        for (let i = 0; i < this.type.expected; i++) {
            buf.push(hex(this.value.getUint8(i)));
            if (i > 10) {
                buf.push('...');
                break;
            }
        }
        return buf.join('');
    }
}

abstract class Numeric implements Type {
    constructor(readonly name: string) { }
    abstract getNum(view: DataView): number;
    abstract len: number;
    parse(view: DataView): TypeInst {
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

export interface StructField {
    ofs?: string;
    type: Type;
}
export class Struct implements Type {
    constructor(readonly name: string, readonly fields: StructField[]) { }
    parse(view: DataView): TypeInst {
        let ofs = 0;
        const insts = [];
        for (const f of this.fields) {
            let fofs = ofs;
            if (f.ofs) {
                fofs = 0x80;  // TODO: expression evaluator
            }
            const inst = f.type.parse(new DataView(view.buffer, view.byteOffset + fofs));
            insts.push(inst);
            ofs += inst.len;
        }
        return new StructInst(this, view.byteOffset, ofs, insts);
    }
}
class StructInst implements TypeInst {
    constructor(readonly type: Struct, readonly ofs: number, readonly len: number, readonly children: TypeInst[]) {
    }
    render(): string {
        return '';
    }
}