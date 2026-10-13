export function parseRubric(raw) {
    try {
        const data = JSON.parse(raw || '[]');
        return Array.isArray(data) ? data : [];
    } catch { return []; }
}

export function calculateRubricGrade(raw, scores, status) {
    const rubric = parseRubric(raw);
    if (!rubric.length || status !== 'APPROVED') return null;
    if (!Array.isArray(scores) || scores.length !== rubric.length) {
        throw Object.assign(new Error('Заполните оценки по всем критериям'), { status: 400 });
    }
    const lines = rubric.map((criterion, index) => {
        const score = Number(scores[index]?.score);
        if (!Number.isInteger(score) || score < 0 || score > criterion.max) {
            throw Object.assign(new Error('Некорректный балл по критерию'), { status: 400 });
        }
        return { title: criterion.title, max: criterion.max, score };
    });
    const earned = lines.reduce((n, v) => n + v.score, 0);
    const total = lines.reduce((n, v) => n + v.max, 0);
    return { lines, grade: Math.max(1, Math.round(5 * earned / Math.max(1, total))) };
}
