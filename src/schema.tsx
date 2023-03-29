import { hex } from "./hex";


export interface Type {
    name: string;
    parse(view: DataView): [TypeInst, number];
}

export interface TypeInst {
    type: Type;
    render(): string;
    children?: TypeInst[];
}

export class Literal implements Type {
    constructor(readonly name: string, readonly expected: number) { }
    parse(view: DataView): [TypeInst, number] {
        const value = new DataView(view.buffer, 0, this.expected);
        return [new LiteralInst(this, value), this.expected];
    }
}
class LiteralInst implements TypeInst {
    constructor(readonly type: Literal, private value: DataView) { }
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
    parse(view: DataView): [TypeInst, number] {
        const value = view.getUint32(0, true);
        return [new U32Inst(this, value), 2];
    }
}
class U32Inst implements TypeInst {
    constructor(readonly type: U32, readonly value: number) { }
    render(): string {
        return '0x' + hex(this.value, 0);
    }
}

export class Struct implements Type {
    constructor(readonly name: string, readonly fields: Type[]) { }
    parse(view: DataView): [TypeInst, number] {
        let ofs = 0;
        const insts = [];
        for (const f of this.fields) {
            const [inst, n] = f.parse(new DataView(view.buffer, view.byteOffset + ofs));
            insts.push(inst);
            ofs += n;
        }
        return [new StructInst(this, insts), ofs];
    }
}
class StructInst implements TypeInst {
    constructor(readonly type: Struct, readonly children: TypeInst[]) {
    }
    render(): string {
        return 'struct';
    }
}