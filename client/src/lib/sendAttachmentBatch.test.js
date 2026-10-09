import { describe, expect, it, vi } from 'vitest';
import { sendAttachmentBatch } from './sendAttachmentBatch.js';

const file = (name) => ({ name, type: 'image/png' });
const socketWith = (responses, calls) => ({
    timeout: () => ({
        emit: (_event, payload, callback) => {
            calls.push(payload);
            const response = responses.shift();
            if (response instanceof Error) callback(response);
            else callback(null, response);
        },
    }),
});
const send = (args) => sendAttachmentBatch({ chatId: 'chat', token: 'token', makeId: () => 'stable-id', ...args });

describe('attachment retry idempotency', () => {
    it('retries after lost acknowledgement without uploading again', async () => {
        const f = file('a.png'), calls = [], cache = new Map();
        const upload = vi.fn().mockResolvedValue({ url: '/uploads/a.png' });
        const socket = socketWith([new Error('timeout'), { ok: true }], calls);
        const first = await send({ files: [f], captions: { 0: 'подпись' }, socket, upload, retryCache: cache });
        expect(first.remaining).toEqual([f]);
        expect(first.error).toBeInstanceOf(Error);
        const second = await send({ files: first.remaining, captions: first.captions, socket, upload, retryCache: cache });
        expect(second.error).toBeUndefined();
        expect(upload).toHaveBeenCalledOnce();
        expect(calls).toHaveLength(2);
        expect(calls[0].clientMessageId).toBe(calls[1].clientMessageId);
        expect(calls[1].caption).toBe('подпись');
        expect(cache.size).toBe(0);
    });

    it('keeps remaining captions aligned after partial failure', async () => {
        const files = [file('one'), file('two'), file('three')], calls = [];
        const socket = socketWith([{ ok: true }, { error: 'offline' }], calls);
        const outcome = await send({
            files, captions: { 0: 'first', 1: 'second', 2: 'third' },
            socket, upload: vi.fn(async (f) => ({ url: f.name })),
        });
        expect(outcome.completed).toBe(1);
        expect(outcome.remaining).toEqual(files.slice(1));
        expect(outcome.captions).toEqual({ 0: 'second', 1: 'third' });
    });

    it('does not re-send acknowledged files after retry', async () => {
        const files = [file('one'), file('two')], calls = [];
        const socket = socketWith([{ ok: true }, new Error('timeout'), { ok: true }], calls);
        const upload = vi.fn(async (f) => ({ url: f.name }));
        const cache = new Map();
        const first = await send({ files, captions: {}, socket, upload, retryCache: cache });
        await send({ files: first.remaining, captions: first.captions, socket, upload, retryCache: cache });
        expect(calls.map((x) => x.content)).toEqual(['one', 'two', 'two']);
        expect(upload).toHaveBeenCalledTimes(2);
    });
});
