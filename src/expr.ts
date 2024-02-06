import * as schema from './schema';

function todo(text: string): never {
    throw new Error(text);
}

interface Context {
    root: schema.TypeInst;
}

interface Expr {
    evaluate(ctx: Context): schema.TypeInst;
    sexp(): string;
}

class ExprRoot implements Expr {
    evaluate(ctx: Context): schema.TypeInst {
        return ctx.root;
    }
    sexp() {
        return '(root)';
    }
}

class ExprField implements Expr {
    constructor(readonly expr: Expr, readonly field: string) { }
    evaluate(ctx: Context): schema.TypeInst {
        const self = this.expr.evaluate(ctx);
        if (!self.children) todo('no children');
        for (const c of self.children) {
            if (c.name === this.field) {
                return c.inst;
            }
        }
        todo(`field ${this.field} not found`);
    }
    sexp() {
        return `(${this.expr.sexp()} .${this.field})`;
    }
}

class ExprIndex implements Expr {
    constructor(readonly expr: Expr, readonly index: number) { }
    evaluate(ctx: Context): schema.TypeInst {
        const self = this.expr.evaluate(ctx);
        if (!self.children) todo('no children');
        if (this.index < 0 || this.index >= self.children.length) {
            todo(`field ${this.index} not found`);
        }
        return self.children[this.index].inst;
    }
    sexp() {
        return `(${this.expr.sexp()} [${this.index}])`;
    }
}

export function parse(text: string): Expr {
    const re = /(?<root>root)|(?:\.(?<field>[^.\[]+)|(?:\[(?<index>\d+)\]))/gy;
    let expr = new ExprRoot(); // XXX
    let i = 0;
    while (re.lastIndex < text.length) {
        const m = re.exec(text);
        if (!m) break;
        if (!m.groups) todo('no groups');
        if (m.groups['root']) {
            expr = new ExprRoot();
        } else if (m.groups['field']) {
            expr = new ExprField(expr, m.groups['field']);
        } else if (m.groups['index']) {
            expr = new ExprIndex(expr, parseInt(m.groups['index']));
        }
    }
    if (re.lastIndex < text.length) {
        todo("didn't parse full text");
    }
    console.log(expr.sexp());
    return expr;
}