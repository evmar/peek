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
        hovered?: number;
        onHover(index: number | undefined): void;
    }
}
abstract class GridView extends preact.Component<GridView.Props> {
    abstract class: string;
    abstract cell(byte: number): string;

    onMouseEnter = (ev: MouseEvent) => {
        let node = ev.target as Element;
        let x = findIndex(node);
        let y = findIndex(node.parentElement!);
        this.props.onHover(y * 16 + x);
    };
    onMouseLeave = () => {
        this.props.onHover(undefined);
    };
    render(props: GridView.Props): preact.ComponentChild {
        const rows = [];
        let index = 0;
        for (let y = 0; y < 16; y++) {
            const row = [];
            for (let x = 0; x < 16; x++) {
                const b = props.buf.getUint8(index);
                const className = index === this.props.hovered ? 'hover' : undefined;
                row.push(<span class={className} onMouseEnter={this.onMouseEnter} onMouseLeave={this.onMouseLeave}>{this.cell(b)}</span>);
                index++;
            }
            rows.push(<div>{row}</div>);
        }
        return <pre class={'grid ' + this.class}>{rows}</pre>;
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
    }
    export interface State {
        hovered?: number;
        offsetY: number;
    }
}
class RawView extends preact.Component<RawView.Props, RawView.State> {
    state: RawView.State = { offsetY: 0 };

    onHover = (index: number | undefined) => {
        this.setState({ hovered: index });
    };

    onWheel = (ev: WheelEvent) => {
        let offsetY = Math.max(this.state.offsetY + ev.deltaY, 0);
        this.setState({ offsetY });
    }

    render(props: GridView.Props): preact.ComponentChild {
        let { buf } = this.props;

        const ofs = Math.floor(this.state.offsetY / 16) * 16;
        buf = new DataView(buf.buffer, buf.byteOffset + ofs);

        return <div id='raw' onWheel={this.onWheel}>
            <HexView buf={buf} hovered={this.state.hovered} onHover={this.onHover} />
            <div style='width: 2ex' />
            <ASCIIView buf={buf} hovered={this.state.hovered} onHover={this.onHover} />
        </div>;
    }
}

namespace Tree {
    export interface Props {
        inst: schema.TypeInst;
    }
}
class Tree extends preact.Component<Tree.Props> {
    render() {
        const { inst } = this.props;
        let children;
        if (inst.children) {
            children = <div style={{ paddingLeft: '2ex' }}>
                {inst.children.map(c => <Tree inst={c} />)}
            </div>;
        }
        return <div>
            <div><code>{inst.type.name}</code>: {inst.render()}</div>
            {children}
        </div>;
    }
}

namespace Page {
    export interface Props {
        buf: DataView;
        inst: schema.TypeInst;
    }
}
class Page extends preact.Component<Page.Props> {
    render() {
        return <main>
            <RawView buf={this.props.buf} />
            <br />
            <Tree inst={this.props.inst} />
        </main>;
    }
}

async function main() {
    const data = await (await fetch('BASS.DLL')).arrayBuffer();
    const buf = new DataView(data);

    const type = new schema.Struct('dos', [
        new schema.Literal('e_magic', 2),
        new schema.Literal('e_junk', 0x40 - 4 - 2),
        new schema.U32('e_lfanew'),
    ]);
    const [inst, _] = type.parse(buf);

    preact.render(<Page buf={buf} inst={inst} />, document.body);
}

main();
