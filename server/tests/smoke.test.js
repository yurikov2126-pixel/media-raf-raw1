import { describe, it, expect } from 'vitest';
import * as gamification from '../src/lib/gamification.js';
import * as courseLogic from '../src/lib/courseLogic.js';

describe('gamification module', () => {
    it('экспортирует ключевые функции', () => {
        expect(typeof gamification.awardXp).toBe('function');
        expect(typeof gamification.deductXp).toBe('function');
        expect(typeof gamification.getUserGamification).toBe('function');
        expect(typeof gamification.getLeaderboard).toBe('function');
        expect(typeof gamification.todayUTC).toBe('function');
    });

    it('todayUTC возвращает дату в формате YYYY-MM-DD', () => {
        expect(gamification.todayUTC()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
});

describe('courseLogic module', () => {
    it('экспортирует ключевые функции', () => {
        expect(typeof courseLogic.getLessonStatuses).toBe('function');
        expect(typeof courseLogic.computeAccess).toBe('function');
    });
});