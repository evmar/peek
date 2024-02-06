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

const subsystem = new schema.NumEnum(new schema.U16(), {
    0: 'IMAGE_SUBSYSTEM_UNKNOWN',
    1: 'IMAGE_SUBSYSTEM_NATIVE',
    2: 'IMAGE_SUBSYSTEM_WINDOWS_GUI',
    3: 'IMAGE_SUBSYSTEM_WINDOWS_CUI',
    5: 'IMAGE_SUBSYSTEM_OS2_CUI',
    7: 'IMAGE_SUBSYSTEM_POSIX_CUI',
    8: 'IMAGE_SUBSYSTEM_NATIVE_WINDOWS',
    9: 'IMAGE_SUBSYSTEM_WINDOWS_CE_GUI',
    10: 'IMAGE_SUBSYSTEM_EFI_APPLICATION',
    11: 'IMAGE_SUBSYSTEM_EFI_BOOT_ SERVICE_DRIVER',
    12: 'IMAGE_SUBSYSTEM_EFI_RUNTIME_ DRIVER',
    13: 'IMAGE_SUBSYSTEM_EFI_ROM',
    14: 'IMAGE_SUBSYSTEM_XBOX',
    16: 'IMAGE_SUBSYSTEM_WINDOWS_BOOT_APPLICATION',
});

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
    { name: 'Subsystem', type: subsystem },
    { name: 'DllCharacteristics', type: new schema.U16() },
    { name: 'SizeOfStackReserve', type: new schema.U32() },
    { name: 'SizeOfStackCommit', type: new schema.U32() },
    { name: 'SizeOfHeapReserve', type: new schema.U32() },
    { name: 'SizeOfHeapCommit', type: new schema.U32() },
    { name: 'LoaderFlags', type: new schema.U32() },
    { name: 'NumberOfRvaAndSizes', type: new schema.U32() },
]);

const IMAGE_SECTION_HEADER = new schema.Struct([
    { name: 'Name', type: new schema.Literal(8, true) },
    { name: 'VirtualSize', type: new schema.U32() },
    { name: 'VirtualAddress', type: new schema.U32() },
    { name: 'SizeOfRawData', type: new schema.U32() },
    { name: 'PointerToRawData', type: new schema.U32() },
    { name: 'PointerToRelocations', type: new schema.U32() },
    { name: 'PointerToLinenumbers', type: new schema.U32() },
    { name: 'NumberOfRelocations', type: new schema.U16() },
    { name: 'NumberOfLinenumbers', type: new schema.U16() },
    { name: 'Characteristics', type: new schema.U32() },
]);

const dataDirectoryNames = [
    'export',
    'import',
    'resource',
    'exception',
    'certificate',
    'base relocation',
    'debug',
    'architecture',
    'global ptr',
    'tls',
    'load config',
    'bound import',
    'iat',
    'delay import descriptor',
    'clr runtime header',
    'reserved',
];

const IMAGE_NT_HEADERS32 = new schema.Struct([
    { name: 'Signature', type: new schema.Literal(4, true) },
    { name: 'FileHeader', type: IMAGE_FILE_HEADER },
    { name: 'OptionalHeader', type: IMAGE_OPTIONAL_HEADER },
    {
        name: 'DataDirectories', type: new schema.List(IMAGE_DATA_DIRECTORY,
            'root.IMAGE_NT_HEADERS32.OptionalHeader.NumberOfRvaAndSizes',
            { names: dataDirectoryNames })
    },
    {
        name: 'Sections', type: new schema.List(IMAGE_SECTION_HEADER,
            'root.IMAGE_NT_HEADERS32.FileHeader.NumberOfSections')
    },
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
    },
    // TODO: maybe some sort of 'mapped' type here, it's 1:1 with .Sections
    {
        ofs: 'root.IMAGE_NT_HEADERS32.Sections[0].PointerToRawData',
        name: 'Sections',
        type: new schema.List(new schema.U32(), 1), // TODO
    }
]);
