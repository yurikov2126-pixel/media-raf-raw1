/**
 * Детерминированные перестановки.
 * Используется для шаффла вариантов ответа в тестах —
 * чтобы правильный ответ не был всегда на первом месте.
 */

// FNV-1a hash — превращает строку в 32-битное число
function hashString(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return h >>> 0;
}

// Mulberry32 — быстрый детерминированный PRNG
function mulberry32(seed) {
    return function () {
        seed |= 0;
        seed = (seed + 0x6d2b79f5) | 0;
        let t = seed;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/**
 * Перестановка [0..n-1] по seed.
 * Возвращает массив perm, где:
 *   perm[shuffledPosition] = originalIndex
 * Т.е. элемент на позиции k в перемешанном массиве
 * соответствует элементу perm[k] в исходном.
 *
 * Детерминирован: одинаковый seed → одинаковая перестановка.
 */
export function shuffledIndices(n, seed) {
    if (n <= 1) return Array.from({ length: n }, (_, i) => i);
    const rand = mulberry32(hashString(String(seed)));
    const arr = Array.from({ length: n }, (_, i) => i);
    for (let i = n - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

/**
 * Перемешать массив по seed. Исходный массив не меняется.
 */
export function shuffleArray(arr, seed) {
    const perm = shuffledIndices(arr.length, seed);
    return perm.map((i) => arr[i]);
}