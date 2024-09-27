/**
 * Renders a preformatted grid of either hex or ASCII characters, with support
 * for showing a hover box over a selection.
 */

import * as preact from 'preact';
import { hex, isPrintable } from './hex';

interface Selection {
    start: number;
    end: number;
}

interface CellSize {
    width: number;
    height: number;
    spacer: number;
}

function findIndex(node: Element): number | undefined {
    let n: Element | null = node.parentNode?.firstElementChild!;
    for (let i = 0; n; i++, n = n!.nextElementSibling) {
        if (n === node) return i;
    }
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

export namespace GridView {
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
export class GridView extends preact.Component<GridView.Props, GridView.State> {
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
                if (index >= props.buf.byteLength) break;
                const b = props.buf.getUint8(index);
                row.push(<span key={x} onMouseEnter={this.onMouseEnter} onMouseLeave={this.onMouseLeave}>{toText(b)}</span>);
                index++;
            }
            rows.push(<div key={y}>{row}</div>);
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

