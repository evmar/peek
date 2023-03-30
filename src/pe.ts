import * as schema from './schema';

const IMAGE_DATA_DIRECTORY = new schema.Struct([
    { name: 'VirtualAddress', type: new schema.U32() },
    { name: 'Size', type: new schema.U32() },
]);

const IMAGE_FILE_HEADER = new schema.Struct([
    {
        name: 'Machine',
        type: new schema.NumEnum(new schema.U16(), {
            0x14c: 'IMAGE_FILE_MACHINE_I386',
        })
    },
    { name: 'NumberOfSections', type: new schema.U16() },
    { name: 'TimeDateStamp', type: new schema.U32() },
    { name: 'PointerToSymbolTable', type: new schema.U32() },
    { name: 'NumberOfSymbols', type: new schema.U32() },
    { name: 'SizeOfOptionalHeader', type: new schema.U16() },
    { name: 'Characteristics', type: new schema.U16() },
]);


const IMAGE_OPTIONAL_HEADER = new schema.Struct([
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
]);

const IMAGE_NT_HEADERS32 = new schema.Struct([
    { name: 'Signature', type: new schema.Literal(4, true) },
    { name: 'FileHeader', type: IMAGE_FILE_HEADER },
    { name: 'OptionalHeader', type: IMAGE_OPTIONAL_HEADER },
    { name: 'DataDirectories', type: new schema.List(IMAGE_DATA_DIRECTORY, 0x10) },
]);


export const type = new schema.Struct([
    {
        name: 'dos', type: new schema.Struct([
            { name: 'e_magic', type: new schema.Literal(2, true) },
            { name: 'e_junk', type: new schema.Literal(0x40 - 4 - 2, false) },
            { name: 'e_lfanew', type: new schema.U32() },
        ])
    },
    {
        ofs: 'root.dos.e_lfanew',
        name: 'IMAGE_NT_HEADERS32', type: IMAGE_NT_HEADERS32,
    }
]);