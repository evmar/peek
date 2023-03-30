import * as preact from 'preact';
import { h, Fragment } from 'preact';
import { hex, isPrintable } from './hex';
import * as schema from './schema';
import * as pe from './pe';

function findIndex(node: Element): number | undefined {
    let n: Element | null = node.parentNode?.firstElementChild!;
    for (let i = 0; n; i++, n = n!.nextElementSibling) {
        if (n === node) return i;
    }
}

interface Selection {
    start: number;
    end: number;
}

interface CellSize {
    width: number;
    height: number;
    spacer: number;
}

namespace HoverBox {
    export interface Props {
        cell: CellSize;
        sel: Selection;
    }
}
class HoverBox extends preact.Component<HoverBox.Props> {
    render(): preact.ComponentChild {
        const [cx0, cy0] = [this.props.sel.start % 16, Math.floor(this.props.sel.start / 16)];
        const [cx1, cy1] = [this.props.sel.end % 16, Math.floor(this.props.sel.end / 16)];

        const cellSWidth = this.props.cell.width + this.props.cell.spacer;
        const cellWidth = this.props.cell.width;
        const cellHeight = this.props.cell.height;
        const pad = 1;
        const xLeft = (cx: number) => cx * cellSWidth - pad;
        const xRight = (cx: number) => cx * cellSWidth + cellWidth + pad;

        const yTop = (cy: number) => cy * cellHeight - pad;
        const yBot = (cy: number) => cy * cellHeight + cellHeight + pad;

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

function toPrintable(byte: number): string {
    if (isPrintable(byte))
        return String.fromCharCode(byte);
    return '.';
}

namespace GridView {
    export interface Props {
        mode: 'ascii' | 'hex';
        buf: DataView;
        sel?: Selection;
        onHover(sel: Selection | undefined): void;
    }
    export interface State {
        cell?: CellSize;
    }
}
class GridView extends preact.Component<GridView.Props, GridView.State> {
    measureRef = preact.createRef<HTMLPreElement>();
    gridRef = preact.createRef<HTMLPreElement>();

    onMouseEnter = (ev: MouseEvent) => {
        let node = ev.target as Element;
        let x = findIndex(node)!;
        let y = findIndex(node.parentElement!)!;
        let pos = y * 16 + x;
        this.props.onHover({ start: pos, end: pos });
    };
    onMouseLeave = () => {
        this.props.onHover(undefined);
    };

    componentDidMount() {
        document.fonts.ready.then(() => {
            // Need to wait for fonts to load before measuring character size.
            const rect = this.measureRef.current!.getBoundingClientRect();
            this.setState({
                cell: {
                    width: rect.width * (this.props.mode === 'hex' ? 2 : 1),
                    height: rect.height,
                    spacer: this.props.mode === 'hex' ? rect.width * 0.5 : 0,
                },
            });
        });
    }

    render(props: GridView.Props): preact.ComponentChild {
        if (!this.state.cell) {
            return <pre ref={this.gridRef} class='grid'>
                <span ref={this.measureRef} style={{ position: 'relative' }}>0</span>
            </pre>;
        }

        const rows = [];
        let index = 0;
        const toText = this.props.mode === 'hex' ? hex : toPrintable;
        for (let y = 0; (y + 1) * this.state.cell.height < this.gridRef.current!.offsetHeight; y++) {
            const row = [];
            for (let x = 0; x < 16; x++) {
                const b = props.buf.getUint8(index);
                row.push(<span onMouseEnter={this.onMouseEnter} onMouseLeave={this.onMouseLeave}>{toText(b)}</span>);
                index++;
            }
            rows.push(<div>{row}</div>);
        }

        let hover;
        if (this.props.sel) {
            hover = <HoverBox cell={this.state.cell} sel={this.props.sel} />;
        }
        return <pre ref={this.gridRef} class={'grid ' + this.props.mode}>
            {rows}
            {hover}
        </pre>;
    }
}

namespace RawView {
    export interface Props {
        buf: DataView;
        onHover(sel: Selection | undefined): void;
        sel?: Selection;
    }
    export interface State {
        offsetY: number;
    }
}
class RawView extends preact.Component<RawView.Props, RawView.State> {
    state: RawView.State = { offsetY: 0 };

    ofs(): number {
        return Math.floor(this.state.offsetY / 16) * 16;
    }

    onWheel = (ev: WheelEvent) => {
        let offsetY = Math.max(this.state.offsetY + ev.deltaY, 0);
        this.setState({ offsetY });
    }

    onHover = (sel: Selection | undefined) => {
        if (sel) {
            const ofs = this.ofs();
            sel.start += ofs;
            sel.end += ofs;
        }
        this.props.onHover(sel);
    }

    render(props: GridView.Props): preact.ComponentChild {
        let { buf } = this.props;
        const ofs = Math.floor(this.state.offsetY / 16) * 16;

        let sel;
        if (this.props.sel) {
            // Ensure selection is within visual bounds.
            sel = { ...this.props.sel };
            sel.start -= ofs;
            if (sel.start < 0) sel.start = 0;
            sel.end -= ofs;
            if (sel.end < 0) sel = undefined;
        }

        buf = new DataView(buf.buffer, buf.byteOffset + ofs);

        return <div id='raw' onWheel={this.onWheel}>
            <GridView mode='hex' buf={buf} sel={sel} onHover={this.onHover} />
            <div style='width: 2ex' />
            <GridView mode='ascii' buf={buf} sel={sel} onHover={this.onHover} />
        </div>;
    }
}

namespace TreeNode {
    export interface Props {
        name?: string;
        inst: schema.TypeInst;
        onHover(sel: Selection | undefined): void;
    }
}
class TreeNode extends preact.Component<TreeNode.Props> {
    onMouseEnter = () => {
        const { inst } = this.props;
        this.props.onHover({ start: inst.ofs, end: inst.ofs + inst.len - 1 });
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
        sel?: Selection;
    }
}
class Page extends preact.Component<Page.Props, Page.State> {
    onHover = (sel: Selection | undefined) => {
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
