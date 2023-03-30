import * as preact from 'preact';
import { h, Fragment } from 'preact';
import { hex, isPrintable } from './hex';
import * as schema from './schema';
import * as pe from './pe';

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
        ofs: number;
        sel?: [number, number];
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
    measureRef = preact.createRef<HTMLPreElement>();
    gridRef = preact.createRef<HTMLPreElement>();

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
            const rect = this.measureRef.current!.getBoundingClientRect();
            this.setState({
                chWidth: rect.width,
                chHeight: rect.height,
            });
        });
    }

    render(props: GridView.Props): preact.ComponentChild {
        if (!this.state.chWidth) {
            return <pre ref={this.gridRef} class='grid'>
                <span ref={this.measureRef} style={{ position: 'relative' }}>0</span>
            </pre>;
        }

        const rows = [];
        let index = this.props.ofs;
        for (let y = 0; (y + 1) * this.state.chHeight < this.gridRef.current!.offsetHeight; y++) {
            const row = [];
            for (let x = 0; x < 16; x++) {
                const b = props.buf.getUint8(index);
                row.push(<span onMouseEnter={this.onMouseEnter} onMouseLeave={this.onMouseLeave}>{this.cell(b)}</span>);
                index++;
            }
            rows.push(<div>{row}</div>);
        }

        return <pre ref={this.gridRef} class={'grid ' + this.class}>
            {rows}
            {this.renderHover()}
        </pre>;
    }

    private renderHover(): preact.ComponentChild | undefined {
        if (!this.props.sel) return;

        // Ensure selection is within visual bounds.
        let [sel, selEnd] = this.props.sel;
        selEnd = selEnd ? selEnd - 1 : sel;
        sel -= this.props.ofs;
        if (sel < 0) sel = 0;
        selEnd -= this.props.ofs;
        if (selEnd < 0) return;

        const [cx0, cy0] = [sel % 16, Math.floor(sel / 16)];
        const [cx1, cy1] = [selEnd % 16, Math.floor(selEnd / 16)];

        const letterWidth = this.state.chWidth;
        const letterHeight = this.state.chHeight;
        const cellSWidth = this.class === 'hex' ? 2.5 * letterWidth : letterWidth;
        const cellWidth = this.class === 'hex' ? 2 * letterWidth : letterWidth;
        const pad = 1;
        const xLeft = (cx: number) => cx * cellSWidth - pad;
        const xRight = (cx: number) => cx * cellSWidth + cellWidth + pad;

        const yTop = (cy: number) => cy * letterHeight - pad;
        const yBot = (cy: number) => cy * letterHeight + letterHeight + pad;

        // Selection possibly looks like:
        //          start-> +----+
        //              +---+    | <- right wall
        // left wall -> |        |
        //              |      +-+
        //              +------+ <- end
        const pathops = [
            // upper left
            `M${xLeft(cx0)} ${yTop(cy0)}`
        ];
        if (cy1 > cy0) {
            // right wall
            pathops.push(`L${xRight(15)} ${yTop(cy0)}`);
            pathops.push(`L${xRight(15)} ${yTop(cy1)}`);
        }
        // end upper right
        pathops.push(`L${xRight(cx1)} ${yTop(cy1)}`);
        // end lower right
        pathops.push(`L${xRight(cx1)} ${yBot(cy1)}`);
        if (cy1 > cy0) {
            // left wall
            pathops.push(`L${xLeft(0)} ${yBot(cy1)}`);
            pathops.push(`L${xLeft(0)} ${yBot(cy0)}`);
        }
        // end lower left
        pathops.push(`L${xLeft(cx0)} ${yBot(cy0)}`);
        pathops.push(`Z`);
        return <svg class='hover-box'>
            <path d={pathops.join(' ')} stroke='red' fill='none' />
        </svg>;
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
        if (isPrintable(byte))
            return String.fromCharCode(byte);
        return '.';
    }
}

namespace RawView {
    export interface Props {
        buf: DataView;
        onHover(sel: [number, number] | undefined): void;
        sel?: [number, number];
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
        let { buf, sel } = this.props;

        const ofs = Math.floor(this.state.offsetY / 16) * 16;
        buf = new DataView(buf.buffer, buf.byteOffset);

        return <div id='raw' onWheel={this.onWheel}>
            <HexView buf={buf} ofs={ofs} sel={sel} onHover={this.props.onHover} />
            <div style='width: 2ex' />
            <ASCIIView buf={buf} ofs={ofs} sel={sel} onHover={this.props.onHover} />
        </div>;
    }
}

namespace TreeNode {
    export interface Props {
        name?: string;
        inst: schema.TypeInst;
        onHover(sel: [number, number?] | undefined): void;
    }
}
class TreeNode extends preact.Component<TreeNode.Props> {
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
                {inst.children.map(({ name, inst }) => <TreeNode name={name} inst={inst} onHover={this.props.onHover} />)}
            </div>;
        }
        return <div>
            <div onMouseEnter={this.onMouseEnter} onMouseLeave={this.onMouseLeave}>
                <code>{this.props.name ? this.props.name + ': ' : '-'}{inst.render()}</code>
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
        sel?: [number, number];
    }
}
class Page extends preact.Component<Page.Props, Page.State> {
    onHover = (sel: [number, number] | undefined) => {
        this.setState({ sel });
    };

    render() {
        return <main>
            <RawView buf={this.props.buf} sel={this.state.sel} onHover={this.onHover} />
            <br />
            <div id='tree'>
                <TreeNode name={'file'} inst={this.props.inst} onHover={this.onHover} />
            </div>
        </main>;
    }
}

async function main() {
    const data = await (await fetch('BASS.DLL')).arrayBuffer();
    const buf = new DataView(data);

    const inst = pe.type.parse(buf);

    preact.render(<Page buf={buf} inst={inst} />, document.body);
}

main();
