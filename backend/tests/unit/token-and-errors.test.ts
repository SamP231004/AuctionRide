import { Prisma } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { toAppError } from '../../src/middlewares/error-handler.js';
import { TokenService } from '../../src/services/token.service.js';
import { AuthenticationError, NotFoundError } from '../../src/utils/errors.js';
import { maskName } from '../../src/utils/privacy.js';

const config = { secret: 'x'.repeat(40), ttl: '15m', issuer: 'test-iss', audience: 'test-aud' };

describe('TokenService', () => {
  const tokens = new TokenService(config);

  it('round-trips a user through sign and verify', () => {
    const token = tokens.signAccessToken({ id: 'user-1', role: 'BUYER' });
    expect(tokens.verifyAccessToken(token)).toEqual({ id: 'user-1', role: 'BUYER' });
  });

  it('reports expired tokens with a distinct code so clients know to refresh', () => {
    const expired = jwt.sign({ role: 'BUYER' }, config.secret, {
      subject: 'user-1',
      expiresIn: -10,
      issuer: config.issuer,
      audience: config.audience,
    });
    expect(() => tokens.verifyAccessToken(expired)).toThrowError(
      expect.objectContaining({ code: 'TOKEN_EXPIRED' }) as Error,
    );
  });

  it('rejects tokens signed with another secret', () => {
    const forged = jwt.sign({ role: 'ADMIN' }, 'y'.repeat(40), { subject: 'attacker', issuer: config.issuer, audience: config.audience });
    expect(() => tokens.verifyAccessToken(forged)).toThrow(AuthenticationError);
  });

  it('rejects tokens for another audience', () => {
    const other = new TokenService({ ...config, audience: 'other' }).signAccessToken({ id: 'u', role: 'ADMIN' });
    expect(() => tokens.verifyAccessToken(other)).toThrow(AuthenticationError);
  });

  it('rejects the "none" algorithm', () => {
    const unsigned = jwt.sign({ role: 'ADMIN', sub: 'u', iss: config.issuer, aud: config.audience }, '', { algorithm: 'none' });
    expect(() => tokens.verifyAccessToken(unsigned)).toThrow(AuthenticationError);
  });
});

describe('toAppError', () => {
  it('maps zod errors to a 400 with field details', () => {
    const result = z.object({ email: z.string().email() }).safeParse({ email: 'nope' });
    const error = toAppError(result.error);
    expect(error.statusCode).toBe(400);
    expect(error.details).toEqual([{ path: 'email', message: 'Invalid email' }]);
  });

  it('maps Prisma unique violations to 409', () => {
    const prismaError = new Prisma.PrismaClientKnownRequestError('dup', { code: 'P2002', clientVersion: 'test' });
    expect(toAppError(prismaError).statusCode).toBe(409);
  });

  it('passes application errors through unchanged', () => {
    const notFound = new NotFoundError('Auction');
    expect(toAppError(notFound)).toBe(notFound);
  });

  it('hides unknown errors behind a generic 500', () => {
    const error = toAppError(new Error('database password is hunter2'));
    expect(error.statusCode).toBe(500);
    expect(error.message).not.toContain('hunter2');
  });
});

describe('maskName', () => {
  it.each([
    ['Rahul Sharma', 'R***l S.'],
    ['Al', 'A*'],
    ['Diya', 'D***a'],
  ])('%s → %s', (input, expected) => {
    expect(maskName(input)).toBe(expected);
  });
});
