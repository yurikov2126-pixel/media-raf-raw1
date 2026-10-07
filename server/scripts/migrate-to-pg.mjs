// Миграция SQLite → PostgreSQL через два Prisma-клиента.
// Prisma сама конвертирует типы, поэтому проблемы pgloader
// (миллисекунды → дата, регистр колонок, кавычки) не возникают.

import { createRequire } from 'module';
import { PrismaClient } from '@prisma/client';

const require = createRequire(import.meta.url);

let sqliteDb;
try {
  const Database = require('better-sqlite3');
  sqliteDb = new Database('/www/wwwroot/mediarafraw.ru/server/prisma/dev.db', {
    readonly: true,
    fileMustExist: true,
  });
  console.log('[sqlite] используем better-sqlite3');
} catch (e1) {
  try {
    const { DatabaseSync } = await import('node:sqlite');
    sqliteDb = new DatabaseSync('/www/wwwroot/mediarafraw.ru/server/prisma/dev.db', {
      readOnly: true,
    });
    console.log('[sqlite] используем встроенный node:sqlite');
  } catch (e2) {
    console.error('Не удалось открыть SQLite. Установите better-sqlite3:');
    console.error('  npm install better-sqlite3');
    console.error('Ошибки:', e1.message, '|', e2.message);
    process.exit(1);
  }
}

function queryAll(sql) {
  return sqliteDb.prepare(sql).all();
}

const pg = new PrismaClient();

const MODEL_TABLE = {
  setting: 'Setting',
  wikiCategory: 'WikiCategory',
  user: 'User',
  course: 'Course',
  adminAction: 'AdminAction',
  post: 'Post',
  chat: 'Chat',
  chatMember: 'ChatMember',
  postReaction: 'PostReaction',
  lesson: 'Lesson',
  test: 'Test',
  question: 'Question',
  enrollment: 'Enrollment',
  lessonProgress: 'LessonProgress',
  certificate: 'Certificate',
  notification: 'Notification',
  wikiArticle: 'WikiArticle',
  pushSubscription: 'PushSubscription',
  testAttempt: 'TestAttempt',
  reaction: 'Reaction',
  comment: 'Comment',
  message: 'Message',
};

// Prisma в SQLite хранит DateTime как INTEGER (мс с epoch)
const DATE_FIELDS = {
  User: ['birthDate', 'lastSeen', 'createdAt'],
  Post: ['editedAt', 'createdAt'],
  Comment: ['editedAt', 'deletedAt', 'createdAt'],
  PostReaction: ['createdAt'],
  Chat: ['createdAt'],
  ChatMember: ['joinedAt', 'lastRead'],
  Message: ['editedAt', 'deletedAt', 'createdAt'],
  Reaction: ['createdAt'],
  Course: ['createdAt'],
  TestAttempt: ['createdAt'],
  Enrollment: ['createdAt'],
  LessonProgress: ['updatedAt'],
  Certificate: ['issuedAt'],
  Notification: ['readAt', 'createdAt'],
  AdminAction: ['createdAt'],
  WikiCategory: ['createdAt'],
  WikiArticle: ['createdAt', 'updatedAt'],
  PushSubscription: ['createdAt', 'lastUsed'],
};

// SQLite хранит Boolean как 0/1 (INTEGER). Prisma Client требует настоящий
// JS boolean — иначе "Invalid value provided. Expected Boolean, provided Int"
const BOOLEAN_FIELDS = {
  User: ['isBanned'],
  Course: ['published'],
  WikiArticle: ['published'],
  TestAttempt: ['passed'],
  Enrollment: ['completed'],
  LessonProgress: ['completed'],
};

const ORDER = [
  'setting', 'wikiCategory', 'user', 'course', 'adminAction',
  'post', 'chat', 'chatMember', 'postReaction',
  'lesson', 'test', 'question',
  'enrollment', 'lessonProgress', 'certificate', 'notification',
  'wikiArticle', 'pushSubscription', 'testAttempt', 'reaction',
  'comment', 'message',
];

function convertRow(tableName, row) {
  const out = { ...row };

  for (const f of DATE_FIELDS[tableName] || []) {
    const v = out[f];
    if (v == null) continue;
    if (typeof v === 'number') out[f] = new Date(v);
    else if (typeof v === 'bigint') out[f] = new Date(Number(v));
    else if (typeof v === 'string' && /^\d+$/.test(v)) out[f] = new Date(parseInt(v, 10));
  }

  for (const f of BOOLEAN_FIELDS[tableName] || []) {
    const v = out[f];
    if (v == null) continue;
    // SQLite хранит 0/1; встречаются также варианты "1"/"true"
    if (typeof v === 'number' || typeof v === 'bigint') out[f] = v !== 0;
    else if (typeof v === 'string') out[f] = v === '1' || v.toLowerCase() === 'true';
    else out[f] = !!v;
  }

  // BigInt → Number для целочисленных полей (pageSize в SQLite редко,
  // но лучше подстраховаться — Prisma Int не принимает BigInt)
  for (const [k, v] of Object.entries(out)) {
    if (typeof v === 'bigint') out[k] = Number(v);
  }

  return out;
}

function sortBySelfRef(rows, parentField) {
  const byId = new Map(rows.map((r) => [r.id, r]));
  const sorted = [];
  const visiting = new Set();
  const visited = new Set();

  function visit(row) {
    if (visited.has(row.id)) return;
    if (visiting.has(row.id)) return;
    visiting.add(row.id);
    const pid = row[parentField];
    if (pid && byId.has(pid)) visit(byId.get(pid));
    visiting.delete(row.id);
    visited.add(row.id);
    sorted.push(row);
  }

  for (const row of rows) visit(row);
  return sorted;
}

function shortErr(e) {
  const code = e.code || '';
  let msg = e.message || String(e);
  // Prisma дублирует много контекста — оставляем только суть
  const meta = e.meta ? JSON.stringify(e.meta).slice(0, 150) : '';
  // Обрезаем длинные приглашения Prisma
  const firstLine = msg.split('\n').find((l) => l.trim() && !l.trim().startsWith('{'));
  return `${code} ${firstLine ? firstLine.slice(0, 160) : ''} ${meta}`.trim();
}

async function copyModel(modelName, opts = {}) {
  const tableName = MODEL_TABLE[modelName];
  let rows;
  try {
    rows = queryAll(`SELECT * FROM "${tableName}"`);
  } catch (e) {
    console.log(`  — ${tableName}: пропущено (${e.message})`);
    return { total: 0, ok: 0, failed: 0 };
  }

  if (opts.selfRef) rows = sortBySelfRef(rows, opts.selfRef);

  let ok = 0, failed = 0;
  const errors = [];

  for (const raw of rows) {
    const data = convertRow(tableName, raw);
    try {
      await pg[modelName].create({ data });
      ok++;
    } catch (e) {
      failed++;
      if (errors.length < 5) errors.push(`${raw.id}: ${shortErr(e)}`);
    }
  }

  const mark = failed === 0 ? '✓' : '✗';
  console.log(`  ${mark} ${tableName}: ${ok}/${rows.length}${failed ? ` (${failed} ошибок)` : ''}`);
  for (const err of errors) console.log(`      ${err}`);

  return { total: rows.length, ok, failed };
}

async function main() {
  console.log('=== Миграция SQLite → PostgreSQL ===\n');

  const userCount = await pg.user.count().catch(() => -1);
  if (userCount > 0) {
    console.error(`Целевая база уже содержит ${userCount} пользователей.`);
    console.error('Сбросьте её и создайте схему через: npx prisma db push');
    await pg.$disconnect();
    process.exit(1);
  }

  console.log('Копирование данных...\n');

  const tasks = {
    setting: () => copyModel('setting'),
    wikiCategory: () => copyModel('wikiCategory'),
    user: () => copyModel('user'),
    course: () => copyModel('course'),
    adminAction: () => copyModel('adminAction'),
    post: () => copyModel('post'),
    chat: () => copyModel('chat'),
    chatMember: () => copyModel('chatMember'),
    postReaction: () => copyModel('postReaction'),
    lesson: () => copyModel('lesson'),
    test: () => copyModel('test'),
    question: () => copyModel('question'),
    enrollment: () => copyModel('enrollment'),
    lessonProgress: () => copyModel('lessonProgress'),
    certificate: () => copyModel('certificate'),
    notification: () => copyModel('notification'),
    wikiArticle: () => copyModel('wikiArticle'),
    pushSubscription: () => copyModel('pushSubscription'),
    testAttempt: () => copyModel('testAttempt'),
    reaction: () => copyModel('reaction'),
    comment: () => copyModel('comment', { selfRef: 'parentId' }),
    message: () => copyModel('message', { selfRef: 'replyToId' }),
  };

  let total = 0, ok = 0, failed = 0;

  for (const modelName of ORDER) {
    const r = await tasks[modelName]();
    total += r.total;
    ok += r.ok;
    failed += r.failed;
  }

  console.log(`\n=== Итог ===`);
  console.log(`Скопировано: ${ok}/${total} записей${failed ? `, ${failed} с ошибками` : ''}`);

  await pg.$disconnect();
}

main().catch((e) => {
  console.error('FATAL:', e);
  process.exit(1);
});root@ubuntu:/www/wwwroot/mediarafraw.ru# 
