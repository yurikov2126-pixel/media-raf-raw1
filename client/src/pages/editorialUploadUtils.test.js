import { describe, expect, it } from 'vitest';
import { batchUploadProgress, removeUploadedItem, canSubmitReview } from './editorialUploadUtils.js';

describe('editorial batch upload stability', () => {
    it('reports total progress across multiple files', () => {
        expect(batchUploadProgress(0, 4, 50)).toBe(13);
        expect(batchUploadProgress(2, 4, 50)).toBe(63);
        expect(batchUploadProgress(4, 4, 0)).toBe(100);
    });
    it('clamps malformed progress and empty batches', () => {
        expect(batchUploadProgress(0, 0, 50)).toBe(0);
        expect(batchUploadProgress(1, 2, 200)).toBe(100);
        expect(batchUploadProgress(-1, 2, -10)).toBe(0);
    });
    it('preserves failed and not-yet-uploaded files for retry', () => {
        const first = { file: { name: 'one.jpg' } };
        const failed = { file: { name: 'two.jpg' } };
        const third = { file: { name: 'three.jpg' } };
        expect(removeUploadedItem([first, failed, third], first)).toEqual([failed, third]);
    });
    it('prevents double submission and permits already uploaded drafts', () => {
        expect(canSubmitReview({ busy:true, pendingCount:1, uploadedCount:0 })).toBe(false);
        expect(canSubmitReview({ busy:false, pendingCount:0, uploadedCount:0 })).toBe(false);
        expect(canSubmitReview({ busy:false, pendingCount:0, uploadedCount:2 })).toBe(true);
    });
});
