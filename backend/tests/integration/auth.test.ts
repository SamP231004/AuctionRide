import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { bearer, buildTestApp, db, PASSWORD, registerBuyer, resetDatabase, type TestContext } from './helpers.js';

const CSRF = { 'X-Requested-With': 'XMLHttpRequest' };

function refreshCookie(res: request.Response): string {
  const cookies = res.headers['set-cookie'] as unknown as string[] | undefined;
  const cookie = cookies?.find((value) => value.startsWith('ar_rt='));
  if (!cookie) throw new Error('refresh cookie not set');
  return cookie.split(';')[0]!;
}

describe('authentication (integration)', () => {
  let ctx: TestContext;

  beforeEach(async () => {
    await resetDatabase();
    ctx = buildTestApp();
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  it('registers, sets an httpOnly refresh cookie and never returns the password hash', async () => {
    const res = await request(ctx.app)
      .post('/api/auth/register')
      .send({ name: 'Riya Sen', email: '  Riya@Example.com ', password: PASSWORD })
      .expect(201);

    expect(res.body).toMatchObject({ success: true, data: { user: { email: 'riya@example.com', role: 'BUYER' } } });
    expect(JSON.stringify(res.body)).not.toContain('passwordHash');
    const cookie = (res.headers['set-cookie'] as unknown as string[])[0]!;
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/Path=\/api\/auth/);
  });

  it('rejects duplicate emails and weak passwords', async () => {
    await registerBuyer(ctx.app, 'Riya', 'riya@example.com');
    await request(ctx.app)
      .post('/api/auth/register')
      .send({ name: 'Riya', email: 'riya@example.com', password: PASSWORD })
      .expect(409);
    const weak = await request(ctx.app)
      .post('/api/auth/register')
      .send({ name: 'X Y', email: 'x@example.com', password: 'short' })
      .expect(400);
    expect((weak.body as { error: { code: string } }).error.code).toBe('VALIDATION_ERROR');
  });

  it('does not reveal whether an email exists on failed login', async () => {
    await registerBuyer(ctx.app, 'Riya', 'riya@example.com');
    const wrongPassword = await request(ctx.app)
      .post('/api/auth/login')
      .send({ email: 'riya@example.com', password: 'WrongPass1' })
      .expect(401);
    const unknownUser = await request(ctx.app)
      .post('/api/auth/login')
      .send({ email: 'nobody@example.com', password: 'WrongPass1' })
      .expect(401);
    expect((wrongPassword.body as { error: unknown }).error).toMatchObject({ code: 'INVALID_CREDENTIALS' });
    expect((unknownUser.body as { error: { message: string } }).error.message).toBe(
      (wrongPassword.body as { error: { message: string } }).error.message,
    );
  });

  it('rotates refresh tokens and revokes the family when an old token is replayed', async () => {
    const login = await request(ctx.app).post('/api/auth/register').send({ name: 'Riya', email: 'r@example.com', password: PASSWORD });
    const first = refreshCookie(login);

    const rotated = await request(ctx.app).post('/api/auth/refresh').set(CSRF).set('Cookie', first).expect(200);
    const second = refreshCookie(rotated);
    expect(second).not.toBe(first);

    // Simulate theft: the old token is replayed well after rotation.
    ctx.clock.advance(60_000);
    await request(ctx.app).post('/api/auth/refresh').set(CSRF).set('Cookie', first).expect(401);

    // The whole family is now revoked — the legitimate newer token no longer works either.
    const after = await request(ctx.app).post('/api/auth/refresh').set(CSRF).set('Cookie', second).expect(401);
    expect((after.body as { error: { code: string } }).error.code).toBe('REFRESH_TOKEN_INVALID');
  });

  it('requires the CSRF header on cookie-authenticated endpoints', async () => {
    await request(ctx.app).post('/api/auth/refresh').expect(403);
  });

  it('logout revokes the session', async () => {
    const res = await request(ctx.app).post('/api/auth/register').send({ name: 'Riya', email: 'r@example.com', password: PASSWORD });
    const cookie = refreshCookie(res);
    await request(ctx.app).post('/api/auth/logout').set(CSRF).set('Cookie', cookie).expect(204);
    await request(ctx.app).post('/api/auth/refresh').set(CSRF).set('Cookie', cookie).expect(401);
  });

  it('protects routes by authentication and role', async () => {
    const buyer = await registerBuyer(ctx.app, 'Riya', 'r@example.com');
    await request(ctx.app).get('/api/auth/me').expect(401);
    await request(ctx.app).get('/api/auth/me').set(bearer(buyer.token)).expect(200);
    await request(ctx.app).get('/api/admin/dashboard').set(bearer(buyer.token)).expect(403);
    await request(ctx.app).get('/api/auth/me').set(bearer('not-a-jwt')).expect(401);
  });
});
