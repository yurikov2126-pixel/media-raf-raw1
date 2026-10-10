import { createReadStream } from 'node:fs';
import { Readable } from 'node:stream';

// ZIP (store mode): streams original files without buffering photos/videos in RAM.
// Explicitly rejects ZIP64-sized archives to keep the format correct.
const table = Uint32Array.from({ length: 256 }, (_, n) => {
    let value = n;
    for (let bit = 0; bit < 8; bit++) value = value & 1 ? (value >>> 1) ^ 0xedb88320 : value >>> 1;
    return value >>> 0;
});
function crcUpdate(crc, bytes) {
    for (const byte of bytes) crc = table[(crc ^ byte) & 255] ^ (crc >>> 8);
    return crc >>> 0;
}
function safeName(value) {
    const name = String(value || 'file').replace(/\\/g, '/').split('/').pop()
        .replace(/[\x00-\x1f\x7f<>:"|?*]/g, '_').trim().replace(/^\.+$/, 'file');
    return (name || 'file').slice(0, 180);
}
export function zipEntries(files) {
    const used = new Set();
    return files.map(file => {
        let name = safeName(file.name);
        const dot = name.lastIndexOf('.');
        const stem = dot > 0 ? name.slice(0, dot) : name;
        const ext = dot > 0 ? name.slice(dot) : '';
        let suffix = 2;
        while (used.has(name.toLowerCase())) name = `${stem} (${suffix++})${ext}`;
        used.add(name.toLowerCase());
        return { ...file, zipName: name };
    });
}
export function streamZip(files) {
    return Readable.from((async function* () {
        const central = [];
        let offset = 0;
        for (const file of files) {
            const name = Buffer.from(file.zipName, 'utf8');
            const size = file.size;
            if (!Number.isSafeInteger(size) || size < 0 || size > 0xffffffff || name.length > 65535) throw new Error('ZIP file too large');
            const header = Buffer.alloc(30);
            header.writeUInt32LE(0x04034b50, 0);
            header.writeUInt16LE(20, 4);
            header.writeUInt16LE(0x0808, 6); // UTF-8 + data descriptor
            header.writeUInt32LE(0, 14);
            header.writeUInt32LE(0, 18);
            header.writeUInt32LE(0, 22);
            header.writeUInt16LE(name.length, 26);
            yield header; yield name;
            const start = offset;
            offset += header.length + name.length;
            let crc = 0xffffffff;
            let read = 0;
            const source = file.buffer ? Readable.from([file.buffer]) : createReadStream(file.path);
            for await (const chunk of source) {
                read += chunk.length;
                if (read > size) throw new Error('File changed while archiving');
                crc = crcUpdate(crc, chunk);
                yield chunk;
            }
            if (read !== size) throw new Error('File changed while archiving');
            crc = (crc ^ 0xffffffff) >>> 0;
            const descriptor = Buffer.alloc(16);
            descriptor.writeUInt32LE(0x08074b50, 0);
            descriptor.writeUInt32LE(crc, 4);
            descriptor.writeUInt32LE(size, 8);
            descriptor.writeUInt32LE(size, 12);
            yield descriptor;
            offset += size + descriptor.length;
            const record = Buffer.alloc(46);
            record.writeUInt32LE(0x02014b50, 0);
            record.writeUInt16LE(20, 4);
            record.writeUInt16LE(20, 6);
            record.writeUInt16LE(0x0808, 8);
            record.writeUInt32LE(crc, 16);
            record.writeUInt32LE(size, 20);
            record.writeUInt32LE(size, 24);
            record.writeUInt16LE(name.length, 28);
            record.writeUInt32LE(start, 42);
            central.push(record, name);
        }
        const centralSize = central.reduce((n, chunk) => n + chunk.length, 0);
        if (offset + centralSize > 0xffffffff || files.length > 65535) throw new Error('Archive exceeds ZIP32 limits');
        for (const chunk of central) yield chunk;
        const footer = Buffer.alloc(22);
        footer.writeUInt32LE(0x06054b50, 0);
        footer.writeUInt16LE(files.length, 8);
        footer.writeUInt16LE(files.length, 10);
        footer.writeUInt32LE(centralSize, 12);
        footer.writeUInt32LE(offset, 16);
        yield footer;
    })());
}
