import { describe, expect, it } from 'vitest';
import { deadlineState, sortPersonalTasks, taskSummary, isFinished } from './editorialMyTasksUtils.js';

const now = Date.parse('2026-10-10T12:00:00Z');
const task = (id,status,dueAt) => ({ id,status,dueAt,updatedAt:'2026-10-01T00:00:00Z' });
describe('personal task dashboard', () => {
    it('prioritizes revision and overdue work over ordinary tasks', () => {
        const result = sortPersonalTasks([
            task('normal','TODO',null),
            task('overdue','IN_PROGRESS','2026-10-09T12:00:00Z'),
            task('revision','REVISION',null),
        ],now);
        expect(result.map(t=>t.id)).toEqual(['revision','overdue','normal']);
    });
    it('does not flag completed tasks as overdue', () => {
        expect(deadlineState(task('done','DONE','2026-10-01T00:00:00Z'),now)).toBe('none');
        expect(isFinished(task('approved','APPROVED',null))).toBe(true);
    });
    it('counts active, approaching, overdue and revision tasks', () => {
        expect(taskSummary([
            task('a','TODO','2026-10-11T12:00:00Z'),
            task('b','REVISION','2026-10-09T12:00:00Z'),
            task('c','APPROVED','2026-10-01T12:00:00Z'),
        ],now)).toEqual({active:2,soon:1,overdue:1,revision:1});
    });
});
