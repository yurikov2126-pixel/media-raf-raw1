export const DEFAULT_AMP_PRE_SECONDS = 60;
export const DEFAULT_AMP_POST_SECONDS = 30;
export const MAX_AMP_WINDOW_SECONDS = 600;
export function ampSeconds(value, fallback) {
  return Number.isInteger(value) && value >= 0 && value <= MAX_AMP_WINDOW_SECONDS ? value : fallback;
}
export function slotWithinAmpWindow(slot, nowMs, preSeconds, postSeconds) {
  const start=Date.parse(slot.startAt);
  const end=Date.parse(slot.endAt);
  return Number.isFinite(start) && Number.isFinite(end) && end>start &&
    nowMs>=start-preSeconds*1000 && nowMs<end+postSeconds*1000;
}
export function amplifierScheduleWindow(slots, nowMs, preSeconds, postSeconds) {
  return slots.find(slot=>slotWithinAmpWindow(slot,nowMs,preSeconds,postSeconds))||null;
}
