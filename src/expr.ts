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
        todo('field not found');
    }
    sexp() {
        return `(${this.expr.sexp()} .${this.field})`;
    }
}

export function parse(text: string): Expr {
    const re = /(?<root>root)|(?:\.(?<field>[^.]+))/gy;
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
        }
    }
    if (re.lastIndex < text.length) {
        todo("didn't parse full text");
    }
    return expr;
}