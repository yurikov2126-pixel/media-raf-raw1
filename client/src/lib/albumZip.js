// Dependency-free ZIP (store method) for browser album downloads.
// Original image bytes are kept intact; archives are not recompressed.
const encoder = new TextEncoder();
const u16 = (v) => [v & 255, (v >>> 8) & 255];
const u32 = (v) => [v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255];
const table = Uint32Array.from({ length: 256 }, (_, i) => {
    let c = i;
    for (let j = 0; j < 8; j++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1;
    return c >>> 0;
});
function crc32(bytes) {
    let crc = 0xffffffff;
    for (const b of bytes) crc = table[(crc ^ b) & 255] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
}
export function buildAlbumZip(entries) {
    const parts = [], directory = [];
    let offset = 0;
    for (const { name, data } of entries) {
        const filename = encoder.encode(name);
        const checksum = crc32(data);
        const flags = 0x800; // UTF-8 paths
        const local = new Uint8Array([
            ...u32(0x04034b50), ...u16(20), ...u16(flags), ...u16(0),
            ...u16(0), ...u16(0), ...u32(checksum),
            ...u32(data.length), ...u32(data.length), ...u16(filename.length), ...u16(0),
        ]);
        parts.push(local, filename, data);
        directory.push(new Uint8Array([
            ...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(flags), ...u16(0),
            ...u16(0), ...u16(0), ...u32(checksum), ...u32(data.length),
            ...u32(data.length), ...u16(filename.length), ...u16(0), ...u16(0),
            ...u16(0), ...u16(0), ...u32(0), ...u32(offset),
        ]), filename);
        offset += local.length + filename.length + data.length;
    }
    const centralSize = directory.reduce((total, chunk) => total + chunk.length, 0);
    return new Blob([...parts, ...directory, new Uint8Array([
        ...u32(0x06054b50), ...u16(0), ...u16(0), ...u16(entries.length),
        ...u16(entries.length), ...u32(centralSize), ...u32(offset), ...u16(0),
    ])], { type: 'application/zip' });
}
