import * as preact from 'preact';
import { hex, isPrintable } from './hex';
import * as schema from './schema';
import * as pe from './pe';
import { GridView } from './gridview';

interface Selection {
    start: number;
    end: number;
}

namespace RawView {
    export interface Props {
        buf: DataView;
        onHover(sel: Selection | undefined): void;
        sel?: Selection;
    }
    export interface State {
        offsetY: number;
        ofs: number;
    }
}
export class RawView extends preact.Component<RawView.Props, RawView.State> {
    state: RawView.State = { offsetY: 0, ofs: 0 };

    onWheel = (ev: WheelEvent) => {
        const offsetY = Math.max(this.state.offsetY + ev.deltaY, 0);
        const ofs = Math.floor(offsetY / 16) * 16;
        this.setState({ offsetY, ofs });
    }

    onHover = (sel: Selection | undefined) => {
        if (sel) {
            sel.start += this.state.ofs;
            sel.end += this.state.ofs;
        }
        this.props.onHover(sel);
    }

    render(props: GridView.Props): preact.ComponentChild {
        let { buf } = this.props;

        let sel;
        if (this.props.sel) {
            // Ensure selection is within visual bounds.
            sel = { ...this.props.sel };
            sel.start -= this.state.ofs;
            if (sel.start < 0) sel.start = 0;
            sel.end -= this.state.ofs;
            if (sel.end < 0) sel = undefined;
        }

        buf = new DataView(buf.buffer, buf.byteOffset + this.state.ofs);

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
        let value = inst.render();
        if (value) {
            value = `: ${value}`;
        }
        return <div>
            <div onMouseEnter={this.onMouseEnter} onMouseLeave={this.onMouseLeave}>
                <code>{this.props.name ?? '-'}{value}</code>
            </div>
            {children}
        </div>;
    }
}

namespace SelView {
    export interface Props {
        buf: DataView;
        sel?: Selection;
    }
}
class SelView extends preact.Component<SelView.Props> {
    render() {
        return <div id='selview'>
            <code>sel: {this.props.sel ? hex(this.props.sel.start) : ''}</code>
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
            <SelView buf={this.props.buf} sel={this.state.sel} />
            <div id='tree'>
                <TreeNode name={'file'} inst={this.props.inst} onHover={this.onHover} />
            </div>
        </main>;
    }
}

async function main() {
    const exe = window.location.search.substring(1);
    if (!exe) throw new Error('expected file query param');
    const data = await (await fetch(exe)).arrayBuffer();
    const buf = new DataView(data);

    const partial = { inst: null! };
    try {
        pe.type.parse(buf, partial);
    } catch (e: unknown) {
        console.error(e);
    }
    const inst = partial.inst;

    preact.render(<Page buf={buf} inst={inst} />, document.body);
}

main();
