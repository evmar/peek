import * as preact from 'preact';
import { h, Fragment } from 'preact';
import { hex, isPrintable } from './hex';
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
        if (isPrintable(byte))
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
            <div id='tree'>
                <TreeNode name={'file'} inst={this.props.inst} onHover={this.onHover} />
            </div>
        </main>;
    }
}

async function main() {
    const data = await (await fetch('BASS.DLL')).arrayBuffer();
    const buf = new DataView(data);

    const IMAGE_DATA_DIRECTORY = new schema.Struct([
        { name: 'VirtualAddress', type: new schema.U32() },
        { name: 'Size', type: new schema.U32() },
    ])

    const type = new schema.Struct([
        {
            name: 'dos', type: new schema.Struct([
                { name: 'e_magic', type: new schema.Literal(2, true) },
                { name: 'e_junk', type: new schema.Literal(0x40 - 4 - 2, false) },
                { name: 'e_lfanew', type: new schema.U32() },
            ])
        },
        {
            ofs: 'root.dos.e_lfanew',
            name: 'IMAGE_NT_HEADERS32', type: new schema.Struct([
                { name: 'Signature', type: new schema.Literal(4, true) },
                {
                    name: 'FileHeader', type: new schema.Struct([  // IMAGE_FILE_HEADER
                        {
                            name: 'Machine', type: new schema.NumEnum(new schema.U16(), {
                                0x14c: 'IMAGE_FILE_MACHINE_I386',
                            })
                        },
                        { name: 'NumberOfSections', type: new schema.U16() },
                        { name: 'TimeDateStamp', type: new schema.U32() },
                        { name: 'PointerToSymbolTable', type: new schema.U32() },
                        { name: 'NumberOfSymbols', type: new schema.U32() },
                        { name: 'SizeOfOptionalHeader', type: new schema.U16() },
                        { name: 'Characteristics', type: new schema.U16() },
                    ])
                },
                {
                    name: 'OptionalHeader', type: new schema.Struct([  // IMAGE_OPTIONAL_HEADER
                        { name: 'Magic', type: new schema.U16() },
                        { name: 'LinkerVersion', type: new schema.U16() },
                        { name: 'SizeOfCode', type: new schema.U32() },
                        { name: 'SizeOfInitializedData', type: new schema.U32() },
                        { name: 'SizeOfUninitializedData', type: new schema.U32() },
                        { name: 'AddressOfEntryPoint', type: new schema.U32() },
                        { name: 'BaseOfCode', type: new schema.U32() },
                        { name: 'BaseOfData', type: new schema.U32() },
                        { name: 'ImageBase', type: new schema.U32() },
                        { name: 'SectionAlignment', type: new schema.U32() },
                        { name: 'FileAlignment', type: new schema.U32() },
                        { name: 'MajorOperatingSystemVersion', type: new schema.U16() },
                        { name: 'MinorOperatingSystemVersion', type: new schema.U16() },
                        { name: 'MajorImageVersion', type: new schema.U16() },
                        { name: 'MinorImageVersion', type: new schema.U16() },
                        { name: 'MajorSubsystemVersion', type: new schema.U16() },
                        { name: 'MinorSubsystemVersion', type: new schema.U16() },
                        { name: 'Win32VersionValue', type: new schema.U32() },
                        { name: 'SizeOfImage', type: new schema.U32() },
                        { name: 'SizeOfHeaders', type: new schema.U32() },
                        { name: 'CheckSum', type: new schema.U32() },
                        { name: 'Subsystem', type: new schema.U16() },
                        { name: 'DllCharacteristics', type: new schema.U16() },
                        { name: 'SizeOfStackReserve', type: new schema.U32() },
                        { name: 'SizeOfStackCommit', type: new schema.U32() },
                        { name: 'SizeOfHeapReserve', type: new schema.U32() },
                        { name: 'SizeOfHeapCommit', type: new schema.U32() },
                        { name: 'LoaderFlags', type: new schema.U32() },
                        { name: 'NumberOfRvaAndSizes', type: new schema.U32() },
                    ])
                },
                {
                    name: 'DataDirectories', type: new schema.List(IMAGE_DATA_DIRECTORY, 0x10)
                },
            ])
        }
    ]);
    const inst = type.parse(buf);

    preact.render(<Page buf={buf} inst={inst} />, document.body);
}

main();
