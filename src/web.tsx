import * as preact from 'preact';
import { h, Fragment } from 'preact';
import { hex } from './hex';
import * as schema from './schema';

function findIndex(node: Element): number {
    let n: Element | null = node.parentNode?.firstElementChild!;
    for (let i = 0; i < 16; i++, n = n!.nextElementSibling) {
        if (n === node) return i;
    }
    return -1;
}

namespace GridView {
    export interface Props {
        buf: DataView;
        sel?: [number, number?];
        onHover(sel: [number, number?] | undefined): void;
    }
    export interface State {
        chWidth: number;
        chHeight: number;
    }
}
abstract class GridView extends preact.Component<GridView.Props, GridView.State> {
    abstract class: string;
    abstract cell(byte: number): string;
    ref = preact.createRef<HTMLPreElement>();

    onMouseEnter = (ev: MouseEvent) => {
        let node = ev.target as Element;
        let x = findIndex(node);
        let y = findIndex(node.parentElement!);
        this.props.onHover([y * 16 + x]);
    };
    onMouseLeave = () => {
        this.props.onHover(undefined);
    };

    componentDidMount() {
        document.fonts.ready.then(() => {
            // Need to wait for fonts to load before measuring character size.
            const rect = this.ref.current!.getBoundingClientRect();
            this.setState({
                chWidth: rect.width,
                chHeight: rect.height,
            });
        });
    }

    render(props: GridView.Props): preact.ComponentChild {
        if (!this.state.chWidth) {
            return <pre ref={this.ref} class={'grid ' + this.class}>0</pre>;
        }

        const rows = [];
        let index = 0;
        for (let y = 0; y < 16; y++) {
            const row = [];
            for (let x = 0; x < 16; x++) {
                const b = props.buf.getUint8(index);
                row.push(<span onMouseEnter={this.onMouseEnter} onMouseLeave={this.onMouseLeave}>{this.cell(b)}</span>);
                index++;
            }
            rows.push(<div>{row}</div>);
        }

        let hover;
        if (this.props.sel && this.state.chWidth > 0) {
            const letterWidth = this.state.chWidth;
            const letterHeight = this.state.chHeight;
            const spacerWidth = this.class === 'hex' ? 0.5 * letterWidth : 0;
            const cellSWidth = this.class === 'hex' ? 2.5 * letterWidth : letterWidth;
            const cellWidth = this.class === 'hex' ? 2 * letterWidth : letterWidth;
            const pad = 1;
            const [sel, selEnd] = this.props.sel;
            const [cx0, cy0] = [sel % 16, Math.floor(sel / 16)];
            const [cx1, cy1] = selEnd ? [(selEnd - 1) % 16, Math.floor((selEnd - 1) / 16)] : [cx0, cy0];
            // Selection possibly looks like:
            //          start-> +----+
            //              +---+    | <- right wall
            // left wall -> |        |
            //              |      +-+
            //              +------+ <- end
            const pathops = [
                // upper left
                `M${cx0 * cellSWidth - pad} ${cy0 * letterHeight - pad}`
            ];
            if (cy1 > cy0) {
                // right wall
                pathops.push(`L${16 * cellSWidth + pad} ${cy0 * letterHeight - pad}`);
                pathops.push(`L${16 * cellSWidth + pad} ${cy1 * letterHeight - pad}`);
            }
            // end upper right
            pathops.push(`L${cx1 * cellSWidth + cellWidth + pad} ${cy1 * letterHeight - pad}`);
            // end lower right
            pathops.push(`L${cx1 * cellSWidth + cellWidth + pad} ${cy1 * letterHeight + letterHeight + pad}`);
            if (cy1 > cy0) {
                // left wall
                pathops.push(`L${-pad} ${cy1 * letterHeight + letterHeight + pad}`);
                pathops.push(`L${-pad} ${+pad + cy0 * letterHeight + letterHeight}`);
            }
            // end lower left
            pathops.push(`L${cx0 * cellSWidth - pad} ${cy0 * letterHeight + letterHeight + pad}`);
            pathops.push(`Z`);
            hover = <svg class='hover-box'>
                <path d={pathops.join(' ')} stroke='red' fill='none' />
            </svg>;
        }
        return <pre ref={this.ref} class={'grid ' + this.class}>
            {rows}
            {hover}
        </pre>;
    }
}

class HexView extends GridView {
    class = 'hex';
    cell(byte: number): string {
        return hex(byte);
    }
}

class ASCIIView extends GridView {
    class = 'ascii';
    cell(byte: number): string {
        if (byte >= 0x20 && byte < 0x7F)
            return String.fromCharCode(byte);
        return '.';
    }
}

namespace RawView {
    export interface Props {
        buf: DataView;
        onHover(sel: [number, number?] | undefined): void;
        sel?: [number, number?];
    }
    export interface State {
        offsetY: number;
    }
}
class RawView extends preact.Component<RawView.Props, RawView.State> {
    state: RawView.State = { offsetY: 0 };

    onWheel = (ev: WheelEvent) => {
        let offsetY = Math.max(this.state.offsetY + ev.deltaY, 0);
        this.setState({ offsetY });
    }

    render(props: GridView.Props): preact.ComponentChild {
        let { buf } = this.props;

        const ofs = Math.floor(this.state.offsetY / 16) * 16;
        buf = new DataView(buf.buffer, buf.byteOffset + ofs);

        return <div id='raw' onWheel={this.onWheel}>
            <HexView buf={buf} sel={this.props.sel} onHover={this.props.onHover} />
            <div style='width: 2ex' />
            <ASCIIView buf={buf} sel={this.props.sel} onHover={this.props.onHover} />
        </div>;
    }
}

namespace Tree {
    export interface Props {
        inst: schema.TypeInst;
        onHover(sel: [number, number?] | undefined): void;
    }
}
class Tree extends preact.Component<Tree.Props> {
    onMouseEnter = () => {
        const { inst } = this.props;
        this.props.onHover([inst.ofs, inst.ofs + inst.len]);
    };
    onMouseLeave = () => {
        this.props.onHover(undefined);
    };
    render() {
        const { inst } = this.props;
        let children;
        if (inst.children) {
            children = <div style={{ paddingLeft: '2ex' }}>
                {inst.children.map(c => <Tree inst={c} onHover={this.props.onHover} />)}
            </div>;
        }
        return <div>
            <div onMouseEnter={this.onMouseEnter} onMouseLeave={this.onMouseLeave}>
                <code>{inst.type.name}</code>: {inst.render()}
            </div>
            {children}
        </div>;
    }
}

namespace Page {
    export interface Props {
        buf: DataView;
        inst: schema.TypeInst;
    }
    export interface State {
        sel?: [number, number?];
    }
}
class Page extends preact.Component<Page.Props, Page.State> {
    onHover = (sel: [number, number?] | undefined) => {
        this.setState({ sel });
    };

    render() {
        return <main>
            <RawView buf={this.props.buf} sel={this.state.sel} onHover={this.onHover} />
            <br />
            <Tree inst={this.props.inst} onHover={this.onHover} />
        </main>;
    }
}

async function main() {
    const data = await (await fetch('BASS.DLL')).arrayBuffer();
    const buf = new DataView(data);

    const type = new schema.Struct('pe', [
        new schema.Struct('dos', [
            new schema.Literal('e_magic', 2),
            new schema.Literal('e_junk', 0x40 - 4 - 2),
            new schema.U32('e_lfanew'),
        ]),
        new schema.Struct('coff', [
            new schema.U32('sig'),
            new schema.U16('machine'),
        ])
    ]);
    const inst = type.parse(buf);

    preact.render(<Page buf={buf} inst={inst} />, document.body);
}

main();
