import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateRubricGrade, parseRubric } from './rubricGrades.js';

const rubric = JSON.stringify([{ title: 'Композиция', max: 5 }, { title: 'Свет', max: 5 }]);

test('an approved work requires a score for every configured criterion', () => {
    assert.throws(() => calculateRubricGrade(rubric, [], 'APPROVED'), /Заполните/);
    assert.throws(() => calculateRubricGrade(rubric, [{ score: 4 }, { score: '' }], 'APPROVED'), /Некорректный/);
});
test('rubric grade is derived from all criterion points on a five-point scale', () => {
    const result = calculateRubricGrade(rubric, [{ score: 5 }, { score: 3 }], 'APPROVED');
    assert.equal(result.grade, 4);
    assert.equal(result.lines.length, 2);
    assert.equal(result.lines[0].title, 'Композиция');
});
test('an out-of-range score cannot be saved', () => {
    assert.throws(() => calculateRubricGrade(rubric, [{ score: 6 }, { score: 3 }], 'APPROVED'), /Некорректный/);
    assert.throws(() => calculateRubricGrade(rubric, [{ score: -1 }, { score: 3 }], 'APPROVED'), /Некорректный/);
});
test('rejected works and works without rubric allow ordinary reviewing', () => {
    assert.equal(calculateRubricGrade(rubric, undefined, 'REJECTED'), null);
    assert.equal(calculateRubricGrade('[]', undefined, 'APPROVED'), null);
});
test('invalid stored criteria do not crash course rendering', () => {
    assert.deepEqual(parseRubric('not json'), []);
});
