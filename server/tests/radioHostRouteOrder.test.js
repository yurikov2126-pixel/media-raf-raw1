import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/routes/radio.js', import.meta.url), 'utf8');

describe('radio host assignments authorization boundary', () => {
  it('registers host assignment endpoints before the global admin guard', () => {
    const adminGuard = source.indexOf("router.use(requireRole('ADMIN'))");
    expect(adminGuard).toBeGreaterThan(0);
    for (const route of [
      "router.get('/student/episodes'",
      "router.patch('/student/episodes/:id/script'",
      "router.post('/student/episodes/:id/submit'",
      "router.get('/student/episodes/:id/media'",
      "router.patch('/student/episodes/:id/media'",
    ]) {
      const routePosition = source.indexOf(route);
      expect(routePosition, route + ' missing').toBeGreaterThan(0);
      expect(routePosition, route + ' must precede global admin guard').toBeLessThan(adminGuard);
    }
  });

  it('keeps editorial moderation endpoints behind the admin guard', () => {
    const guard = source.indexOf("router.use(requireRole('ADMIN'))");
    expect(source.indexOf("router.post('/editorial/episodes/:id/review'")).toBeGreaterThan(guard);
  });
});
