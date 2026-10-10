import { describe, expect, it } from 'vitest';
import { zipEntries, streamZip } from '../src/lib/editorialZip.js';

describe('editorial ZIP exports', () => {
    it('sanitizes paths and avoids duplicate names', () => {
        const entries = zipEntries([
            { name:'../../фото.png' }, { name:'фото.png' }, { name:'../evil.txt' },
        ]);
        expect(entries.map(e => e.zipName)).toEqual(['фото.png','фото (2).png','evil.txt']);
    });
    it('streams a readable ZIP containing UTF-8 names and captions', async () => {
        const payload = Buffer.from('привет', 'utf8');
        const parts = [];
        for await (const part of streamZip([{ zipName:'Версия 1/фото.txt', size:payload.length, buffer:payload }])) parts.push(part);
        const zip = Buffer.concat(parts);
        expect(zip.readUInt32LE(0)).toBe(0x04034b50);
        expect(zip.includes(Buffer.from('Версия 1/фото.txt'))).toBe(true);
        expect(zip.includes(payload)).toBe(true);
        expect(zip.readUInt32LE(zip.length - 22)).toBe(0x06054b50);
        expect(zip.readUInt16LE(zip.length - 22 + 8)).toBe(1);
    });
    it('rejects changed file sizes rather than silently corrupting ZIP', async () => {
        const chunks = [];
        await expect((async () => {
            for await (const part of streamZip([{ zipName:'test.txt', size:100, buffer:Buffer.from('abc') }])) chunks.push(part);
        })()).rejects.toThrow('File changed');
    });
});
