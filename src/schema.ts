import { hex, isPrintable } from "./hex";
import * as expr from './expr';

export interface Type {
    parse(view: DataView, partial: TypeInstChild, root?: TypeInst): void;
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
    children?: TypeInstChild[];
    eval(): number;
}

/** Before an instantation completes we use a placeholder, which appears on parse failure. */
class Placeholder implements TypeInst {
    type = null!;
    len = 0;
    constructor(readonly ofs: number) { }
    render() { return '<incomplete>'; }
    eval() { return 0; }
}

export class Literal implements Type {
    constructor(readonly expected: number, readonly text: boolean) { }
    parse(view: DataView, partial: TypeInstChild): void {
        const value = new DataView(view.buffer, view.byteOffset, this.expected);
        partial.inst = new LiteralInst(this, view.byteOffset, value);
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
    eval(): number { throw new Error('todo') }
}

abstract class Numeric implements Type {
    abstract getNum(view: DataView): number;
    abstract len: number;
    parse(view: DataView, partial: TypeInstChild): void {
        const value = this.getNum(view);
        partial.inst = new NumericInst(this, view.byteOffset, value);
    }
}
class NumericInst implements TypeInst {
    len = this.type.len;
    constructor(readonly type: Numeric, readonly ofs: number, readonly value: number) { }
    render(): string {
        return '0x' + hex(this.value, 0);
    }
    eval(): number { return this.value; }
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
    parse(view: DataView, partial: TypeInstChild): void {
        const t: TypeInstChild = { inst: new Placeholder(view.byteOffset) };
        this.num.parse(view, partial);
        partial.inst = new NumEnumInst(this, partial.inst as NumericInst);
    }
    eval(): number { throw new Error('todo') }
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
    eval(): number { throw new Error('todo') }
}

export interface StructField {
    name: string;
    ofs?: string;
    type: Type;
}
export class Struct implements Type {
    constructor(readonly fields: StructField[]) { }
    parse(view: DataView, partial: TypeInstChild, root?: TypeInst): void {
        const struct = new StructInst(this, view.byteOffset);
        partial.inst = struct;
        if (!root) root = struct;
        for (const f of this.fields) {
            let fofs = struct.len;
            if (f.ofs) {
                fofs = expr.parse(f.ofs).evaluate({ root }).eval();
            }
            const partial: TypeInstChild = { name: f.name, inst: new Placeholder(view.byteOffset + fofs) };
            struct.children.push(partial);
            f.type.parse(new DataView(view.buffer, view.byteOffset + fofs), partial, root);
            struct.len += partial.inst.len;
        }
    }
}
class StructInst implements TypeInst {
    len = 0;
    children: TypeInstChild[] = [];
    constructor(readonly type: Struct, readonly ofs: number) { }
    render(): string {
        return '';
    }
    eval(): number { throw new Error('todo') }
}

export class List implements Type {
    constructor(readonly inner: Type, readonly count: number | string, readonly extra?: { names?: string[] }) { }
    parse(view: DataView, partial: TypeInstChild, root?: TypeInst): void {
        let ofs = 0;
        let count;
        if (typeof this.count === 'number') {
            count = this.count;
        } else {
            if (!root) throw new Error('need root');
            count = expr.parse(this.count).evaluate({ root: root! }).eval();
        }
        const list = new ListInst(this, view.byteOffset);
        partial.inst = list;
        for (let i = 0; i < count; i++) {
            const name = this.extra?.names?.[i];
            const partial: TypeInstChild = { name, inst: new Placeholder(view.byteOffset + ofs) };
            list.children.push(partial);
            this.inner.parse(new DataView(view.buffer, view.byteOffset + ofs), partial);
            ofs += partial.inst.len;
        }
        list.len = ofs;
    }
}
class ListInst implements TypeInst {
    len = 0;
    children: TypeInstChild[] = [];
    constructor(readonly type: List, readonly ofs: number) { }
    render(): string {
        return `${this.children.length} entries`;
    }
    eval(): number { throw new Error('todo') }
}