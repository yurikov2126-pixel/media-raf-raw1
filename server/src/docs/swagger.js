import swaggerJsdoc from 'swagger-jsdoc';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Конфигурация OpenAPI 3.0.
 *
 * Аннотации ищутся в JSDoc-блоках с тегом @openapi во всех файлах роутов
 * и в app.js. Можно покрывать постепенно: сначала /health, /auth/*,
 * /posts/*, потом остальные.
 *
 * UI доступен на /api/docs (см. app.js).
 * Сырой spec — на /api/docs.json.
 *
 * Важно: при добавлении новой схемы в components.schemas или новой
 * группы в tags — обновляй этот файл. Аннотации в роутах ссылаются
 * на схемы через `$ref: '#/components/schemas/Имя'`.
 */
const options = {
    definition: {
        openapi: '3.0.3',
        info: {
            title: 'MEDIA·RAF·RAW API',
            version: '1.0.0',
            description:
                'Внутренний API студенческого медиацентра Radio Политех-FM. ' +
                'Аутентификация через JWT: заголовок `Authorization: Bearer <token>`.',
            contact: {
                name: 'MEDIA·RAF·RAW team',
            },
        },
        servers: [
            {
                url: '/api',
                description: 'Текущий сервер (относительный путь)',
            },
        ],
        tags: [
            { name: 'System', description: 'Health-check и метаданные' },
            { name: 'Auth', description: 'Регистрация, вход, восстановление пароля' },
            { name: 'Users', description: 'Профили, поиск, редактирование себя' },
            { name: 'Posts', description: 'Лента, публикации, реакции и комментарии' },
        ],
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                    description: 'JWT-токен из ответа `/auth/login` или `/auth/register`.',
                },
            },
            schemas: {
                /* ─────────── Общие ─────────── */
                Error: {
                    type: 'object',
                    properties: {
                        error: {
                            type: 'string',
                            example: 'Неверный логин или пароль',
                        },
                    },
                    required: ['error'],
                },

                /* ─────────── Пользователи ─────────── */
                User: {
                    type: 'object',
                    description:
                        'Публичные поля пользователя. `passwordHash` никогда не возвращается.',
                    properties: {
                        id: { type: 'string', example: 'clz9r8y7q0000abcd1234efgh' },
                        username: { type: 'string', example: 'test_user' },
                        firstName: { type: 'string', example: 'Иван' },
                        lastName: { type: 'string', example: 'Тестов' },
                        fullName: { type: 'string', example: 'Иван Тестов' },
                        phone: { type: 'string', example: '+79991234567' },
                        email: { type: 'string', nullable: true, example: null },
                        avatar: { type: 'string', nullable: true, example: null },
                        cover: { type: 'string', nullable: true, example: null },
                        bio: { type: 'string', nullable: true, example: null },
                        direction: {
                            type: 'string',
                            nullable: true,
                            enum: ['photo', 'video', 'radio', 'sound'],
                            example: 'photo',
                        },
                        role: {
                            type: 'string',
                            enum: ['STUDENT', 'MENTOR', 'ADMIN'],
                            example: 'STUDENT',
                        },
                        isBanned: { type: 'boolean', example: false },
                        group: { type: 'string', nullable: true },
                        city: { type: 'string', nullable: true },
                        skills: {
                            type: 'string',
                            description: 'JSON-массив навыков',
                            example: '[]',
                        },
                        socials: {
                            type: 'string',
                            description: 'JSON-объект соцсетей',
                            example: '{}',
                        },
                        onboardingVersion: { type: 'integer', example: 0 },
                        lastSeen: { type: 'string', format: 'date-time', nullable: true },
                        createdAt: { type: 'string', format: 'date-time' },
                    },
                },
                AuthResponse: {
                    type: 'object',
                    properties: {
                        token: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIs...' },
                        user: { $ref: '#/components/schemas/User' },
                    },
                    required: ['token', 'user'],
                },

                /* ─────────── Посты ─────────── */
                Post: {
                    type: 'object',
                    properties: {
                        id: { type: 'string', example: 'clz9r8y7q0000abcd1234efgh' },
                        authorId: { type: 'string' },
                        content: { type: 'string', example: 'Привет, мир!' },
                        mediaUrl: { type: 'string', nullable: true, example: null },
                        mediaType: {
                            type: 'string',
                            nullable: true,
                            enum: ['image', 'video', null],
                            example: null,
                        },
                        editedAt: { type: 'string', format: 'date-time', nullable: true },
                        createdAt: { type: 'string', format: 'date-time' },
                    },
                },
                PostInFeed: {
                    type: 'object',
                    description:
                        'Пост в ленте с агрегированными реакциями и счётчиком комментариев.',
                    properties: {
                        id: { type: 'string' },
                        content: { type: 'string' },
                        mediaUrl: { type: 'string', nullable: true },
                        mediaType: { type: 'string', nullable: true },
                        createdAt: { type: 'string', format: 'date-time' },
                        editedAt: { type: 'string', format: 'date-time', nullable: true },
                        author: {
                            type: 'object',
                            properties: {
                                id: { type: 'string' },
                                fullName: { type: 'string' },
                                username: { type: 'string' },
                                avatar: { type: 'string', nullable: true },
                                direction: { type: 'string', nullable: true },
                            },
                        },
                        reactions: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    emoji: { type: 'string', example: '❤️' },
                                    count: { type: 'integer', example: 3 },
                                    users: {
                                        type: 'array',
                                        items: { type: 'string' },
                                        description:
                                            'ID пользователей, поставивших реакцию.',
                                    },
                                },
                            },
                        },
                        myReactions: {
                            type: 'array',
                            items: { type: 'string' },
                            description:
                                'Эмодзи, которые поставил текущий пользователь.',
                            example: ['❤️'],
                        },
                        _count: {
                            type: 'object',
                            properties: {
                                comments: { type: 'integer', example: 5 },
                            },
                        },
                    },
                },
                AggregatedReactions: {
                    type: 'object',
                    properties: {
                        reactions: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    emoji: { type: 'string', example: '❤️' },
                                    count: { type: 'integer', example: 3 },
                                    users: {
                                        type: 'array',
                                        items: { type: 'string' },
                                    },
                                },
                            },
                        },
                        my: {
                            type: 'array',
                            items: { type: 'string' },
                            description: 'Эмодзи текущего пользователя.',
                        },
                    },
                },

                /* ─────────── Комментарии ─────────── */
                Comment: {
                    type: 'object',
                    properties: {
                        id: { type: 'string' },
                        postId: { type: 'string' },
                        authorId: { type: 'string' },
                        parentId: { type: 'string', nullable: true },
                        content: { type: 'string', example: 'Отличный пост!' },
                        editedAt: { type: 'string', format: 'date-time', nullable: true },
                        createdAt: { type: 'string', format: 'date-time' },
                        author: {
                            type: 'object',
                            properties: {
                                id: { type: 'string' },
                                fullName: { type: 'string' },
                                username: { type: 'string' },
                                avatar: { type: 'string', nullable: true },
                            },
                        },
                    },
                },
                CommentTree: {
                    allOf: [
                        { $ref: '#/components/schemas/Comment' },
                        {
                            type: 'object',
                            properties: {
                                replies: {
                                    type: 'array',
                                    description:
                                        'Рекурсивное дерево ответов. Отсортировано по `createdAt` (ASC).',
                                    items: { $ref: '#/components/schemas/CommentTree' },
                                },
                            },
                        },
                    ],
                },
            },
        },
        security: [],
    },
    apis: [
        path.join(__dirname, '..', 'routes', '**', '*.js'),
        path.join(__dirname, '..', 'routes', '*.js'),
        path.join(__dirname, '..', 'app.js'),
    ],
};

// swagger-jsdoc v7 возвращает Promise
const swaggerSpec = await swaggerJsdoc(options);

export default swaggerSpec;