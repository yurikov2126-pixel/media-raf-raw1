/** Pure upload helpers shared by the UI and its regression tests. */
export function batchUploadProgress(completed, total, currentPercent = 0) {
    if (!Number.isFinite(total) || total <= 0) return 0;
    const safeCompleted = Math.max(0, Math.min(total, completed));
    const fraction = Math.max(0, Math.min(100, currentPercent)) / 100;
    return Math.round(Math.min(100, ((safeCompleted + (safeCompleted < total ? fraction : 0)) / total) * 100));
}
export function removeUploadedItem(items, uploaded) {
    // Preserve every not-yet-uploaded item after an error or cancellation.
    return items.filter(item => item !== uploaded);
}
export function canSubmitReview({ busy, pendingCount, uploadedCount }) {
    return !busy && (pendingCount > 0 || uploadedCount > 0);
}
