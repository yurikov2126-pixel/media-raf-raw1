export default [
    {
        // Глобальные ignores — отдельный объект БЕЗ других ключей.
        // Так ESLint понимает, что это глобальный ignore, а не фильтр.
        ignores: [
            'node_modules/**',
            'dist/**',
            'coverage/**',
            'prisma/migrations/**',
            'prisma/seed/**',
            'scripts/**',
            '**/scripts/**',
            '**/*.mjs',
        ],
    },
    {
        files: ['**/*.js'],
        languageOptions: {
            ecmaVersion: 2023,
            sourceType: 'module',
            globals: {
                // Node
                process: 'readonly',
                console: 'readonly',
                Buffer: 'readonly',
                __dirname: 'readonly',
                __filename: 'readonly',
                setTimeout: 'readonly',
                setInterval: 'readonly',
                clearInterval: 'readonly',
                clearTimeout: 'readonly',
                setImmediate: 'readonly',
                URL: 'readonly',
                fetch: 'readonly',
            },
        },
        rules: {
            'no-unused-vars': [
                'warn',
                {
                    argsIgnorePattern: '^_',
                    varsIgnorePattern: '^_',
                    caughtErrors: 'none',
                    // `const { passwordHash, ...rest } = user` —
                    // выкидываем поле через rest-деструктуризацию перед
                    // отправкой клиенту. Осознанный паттерн, ESLint не
                    // должен считать его неиспользуемой переменной.
                    ignoreRestSiblings: true,
                },
            ],
            'prefer-const': 'warn',
            'no-console': 'off',
            eqeqeq: ['warn', 'smart'],
            // `catch { /* комментарий */ }` и `try { ... } catch {}` —
            // типичный паттерн «глотаем ожидаемую ошибку».
            // Пустой блок без catch по-прежнему подсвечивается.
            'no-empty': ['warn', { allowEmptyCatch: true }],
            'no-undef': 'error',
        },
    },
    {
        // Тестовые файлы — Vitest-глобалы.
        // Полезно на случай, если тест напишется без явного
        // `import { describe, it } from 'vitest'` (у нас globals: true).
        files: ['tests/**/*.js'],
        languageOptions: {
            globals: {
                describe: 'readonly',
                it: 'readonly',
                test: 'readonly',
                expect: 'readonly',
                beforeAll: 'readonly',
                afterAll: 'readonly',
                beforeEach: 'readonly',
                afterEach: 'readonly',
                vi: 'readonly',
            },
        },
    },
];