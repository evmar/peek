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

export class U32 implements Type {
    constructor(readonly name: string) { }
    parse(view: DataView): TypeInst {
        const value = view.getUint32(0, true);
        return new U32Inst(this, view.byteOffset, value);
    }
}
class U32Inst implements TypeInst {
    len = 4;
    constructor(readonly type: U32, readonly ofs: number, readonly value: number) { }
    render(): string {
        return '0x' + hex(this.value, 0);
    }
}

export class Struct implements Type {
    constructor(readonly name: string, readonly fields: Type[]) { }
    parse(view: DataView): TypeInst {
        let ofs = 0;
        const insts = [];
        for (const f of this.fields) {
            const inst = f.parse(new DataView(view.buffer, view.byteOffset + ofs));
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