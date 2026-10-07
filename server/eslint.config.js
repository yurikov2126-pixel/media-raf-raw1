export default [
    {
        files: ['**/*.js'],
        ignores: [
            'node_modules/**',
            'dist/**',
            'coverage/**',
            'prisma/migrations/**',
            'prisma/seed/**',
            'scripts/**',
            '**/scripts/**',     // ← добавить это
            '**/*.mjs'            // ← и это — .mjs файлы вне src не трогаем
        ],
        languageOptions: {
            ecmaVersion: 2023,
            sourceType: 'module',
            globals: {
                process: 'readonly',
                console: 'readonly',
                Buffer: 'readonly',
                __dirname: 'readonly',
                setTimeout: 'readonly',
                setInterval: 'readonly',
                clearInterval: 'readonly',
                clearTimeout: 'readonly',
                setImmediate: 'readonly',
                URL: 'readonly',
                fetch: 'readonly'
            }
        },
        rules: {
            'no-unused-vars': [
                'warn',
                { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' }
            ],
            'prefer-const': 'warn',
            'no-console': 'off',
            eqeqeq: ['warn', 'smart'],
            'no-empty': 'warn',
            'no-undef': 'error'
        }
    }
];