/**
 * Radio 2.0 schedule compiler.
 * Pure domain logic: NO relay, Windows playback or emergency PA output here.
 * All timestamps are ISO 8601 with timezone offset (UTC accepted).
 */
const isTimestamp = (value) => typeof value === 'string'
    && /(Z|[+-]\d{2}:\d{2})$/.test(value)
    && Number.isFinite(Date.parse(value));

export function validateRadioSlot(slot) {
    if (!slot || typeof slot !== 'object') throw new TypeError('Radio slot is required');
    if (!isTimestamp(slot.startsAt) || !isTimestamp(slot.endsAt)) {
        throw new TypeError('Slot timestamps must include a timezone offset');
    }
    const start = Date.parse(slot.startsAt);
    const end = Date.parse(slot.endsAt);
    if (end <= start) throw new RangeError('Radio slot must have positive duration');
    if (end - start > 24 * 60 * 60 * 1000) throw new RangeError('Radio slot exceeds 24 hours');
    if (typeof slot.id !== 'string' || !slot.id.trim()) throw new TypeError('Radio slot ID is required');
    return { id: slot.id, start, end };
}

/**
 * Compile approved immutable playlist slots into a synchronized on/off plan.
 * Do not use for statutory emergency/evacuation PA.
 */
export function compileRadioSchedule(slots, {
    warmupSeconds = 60,
    cooldownSeconds = 30,
    keepAliveSeconds = 180,
} = {}) {
    for (const value of [warmupSeconds, cooldownSeconds, keepAliveSeconds]) {
        if (!Number.isInteger(value) || value < 0 || value > 3600) {
            throw new RangeError('Timing settings must be integers between 0 and 3600 seconds');
        }
    }
    if (!Array.isArray(slots)) throw new TypeError('Slots must be an array');
    const times = slots.map(validateRadioSlot).sort((a, b) => a.start - b.start);
    for (let i = 1; i < times.length; i++) {
        if (times[i].start < times[i - 1].end) throw new RangeError('Overlapping radio slots');
    }
    const playback = times.map(({ id, start, end }) => ({
        slotId: id,
        startsAt: new Date(start).toISOString(),
        endsAt: new Date(end).toISOString(),
    }));
    const windows = [];
    for (const { start, end } of times) {
        const on = start - warmupSeconds * 1000;
        const off = end + cooldownSeconds * 1000;
        const last = windows.at(-1);
        if (last && on - last.off <= keepAliveSeconds * 1000) {
            last.off = Math.max(last.off, off);
        } else {
            windows.push({ on, off });
        }
    }
    return {
        playback,
        amplifierWindows: windows.map(({ on, off }) => ({
            powerOnAt: new Date(on).toISOString(),
            powerOffAt: new Date(off).toISOString(),
        })),
    };
}
