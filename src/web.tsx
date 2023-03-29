import * as preact from 'preact';
import { h, Fragment } from 'preact';

function hex(n: number, width = 2): string {
    return n.toString(16).padStart(width, '0');
}

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
    }
}
class RawView extends preact.Component<RawView.Props, RawView.State> {
    onHover = (index: number | undefined) => {
        this.setState({ hovered: index });
    };

    render(props: GridView.Props): preact.ComponentChild {
        const { buf } = this.props;
        return <div id='raw'>
            <HexView buf={buf} hovered={this.state.hovered} onHover={this.onHover} />
            <div style='width: 2ex' />
            <ASCIIView buf={buf} hovered={this.state.hovered} onHover={this.onHover} />
        </div>;
    }
}

async function main() {
    const data = await (await fetch('BASS.DLL')).arrayBuffer();
    const buf = new DataView(data);

    preact.render(<RawView buf={buf} />, document.body);
}

main();