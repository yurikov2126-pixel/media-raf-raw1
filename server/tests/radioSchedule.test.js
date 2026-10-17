import { describe, expect, it } from 'vitest';
import { compileRadioSchedule } from '../src/lib/radioSchedule.js';

const slot = (id, startsAt, endsAt) => ({ id, startsAt, endsAt });

describe('Radio 2.0 schedule compiler', () => {
    it('plans amplifier warmup and cooldown around playback', () => {
        const plan = compileRadioSchedule([slot('a', '2026-10-19T10:30:00+03:00', '2026-10-19T10:45:00+03:00')]);
        expect(plan.playback[0].startsAt).toBe('2026-10-19T07:30:00.000Z');
        expect(plan.amplifierWindows).toEqual([{
            powerOnAt: '2026-10-19T07:29:00.000Z',
            powerOffAt: '2026-10-19T07:45:30.000Z',
        }]);
    });
    it('holds power across nearby broadcasts', () => {
        const plan = compileRadioSchedule([
            slot('a', '2026-10-19T10:30:00+03:00', '2026-10-19T10:40:00+03:00'),
            slot('b', '2026-10-19T10:42:00+03:00', '2026-10-19T10:50:00+03:00'),
        ]);
        expect(plan.amplifierWindows).toHaveLength(1);
    });
    it('rejects overlap even in unsorted input', () => {
        expect(() => compileRadioSchedule([
            slot('b', '2026-10-19T10:35:00Z', '2026-10-19T10:50:00Z'),
            slot('a', '2026-10-19T10:30:00Z', '2026-10-19T10:40:00Z'),
        ])).toThrow(/Overlapping/);
    });
    it('rejects ambiguous local times and invalid timing', () => {
        expect(() => compileRadioSchedule([slot('a', '2026-10-19T10:30:00', '2026-10-19T10:45:00')])).toThrow(/timezone/);
        expect(() => compileRadioSchedule([], { warmupSeconds: -1 })).toThrow(/Timing/);
    });
    it('does not mutate input and handles an empty day', () => {
        const entries = [slot('a', '2026-10-19T10:30:00Z', '2026-10-19T10:45:00Z')];
        compileRadioSchedule(entries);
        expect(entries[0].startsAt).toBe('2026-10-19T10:30:00Z');
        expect(compileRadioSchedule([]).amplifierWindows).toEqual([]);
    });
});
