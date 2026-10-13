import type { Request, Response } from 'express';
import { REFRESH_COOKIE_NAME } from '../config/constants.js';
import { clearRefreshCookieOptions, refreshCookieOptions } from '../config/cookies.js';
import { getValidated, requireUser } from '../middlewares/index.js';
import type { AuthService, Session } from '../services/auth.service.js';
import { AuthenticationError } from '../utils/errors.js';
import { requestContext } from '../utils/request.js';
import { sendCreated, sendNoContent, sendSuccess } from '../utils/response.js';
import { loginSchema, registerSchema, updateProfileSchema } from '../validators/auth.validator.js';

function readRefreshCookie(req: Request): string | undefined {
  const value: unknown = (req.cookies as Record<string, unknown> | undefined)?.[REFRESH_COOKIE_NAME];
  return typeof value === 'string' ? value : undefined;
}

export class AuthController {
  constructor(private readonly auth: AuthService) {}

  register = async (req: Request, res: Response) => {
    const { body } = getValidated(req, registerSchema);
    const session = await this.auth.register(body, requestContext(req));
    this.writeSession(res, session, 201);
  };

  login = async (req: Request, res: Response) => {
    const { body } = getValidated(req, loginSchema);
    const session = await this.auth.login(body, requestContext(req));
    this.writeSession(res, session);
  };

  refresh = async (req: Request, res: Response) => {
    try {
      const session = await this.auth.refresh(readRefreshCookie(req), requestContext(req));
      this.writeSession(res, session);
    } catch (error) {
      // A concurrent rotation leaves a valid new cookie in the browser — keep it.
      if (error instanceof AuthenticationError && error.code !== 'REFRESH_TOKEN_ROTATED') {
        res.clearCookie(REFRESH_COOKIE_NAME, clearRefreshCookieOptions());
      }
      throw error;
    }
  };

  logout = async (req: Request, res: Response) => {
    await this.auth.logout(readRefreshCookie(req), requestContext(req));
    res.clearCookie(REFRESH_COOKIE_NAME, clearRefreshCookieOptions());
    sendNoContent(res);
  };

  me = async (req: Request, res: Response) => {
    sendSuccess(res, await this.auth.me(requireUser(req).id));
  };

  updateProfile = async (req: Request, res: Response) => {
    const { body } = getValidated(req, updateProfileSchema);
    sendSuccess(res, await this.auth.updateProfile(requireUser(req).id, body));
  };

  private writeSession(res: Response, session: Session, status = 200): void {
    const maxAge = session.refreshTokenExpiresAt.getTime() - Date.now();
    res.cookie(REFRESH_COOKIE_NAME, session.refreshToken, refreshCookieOptions(maxAge));
    const data = { user: session.user, accessToken: session.accessToken, expiresIn: session.accessTokenExpiresIn };
    if (status === 201) sendCreated(res, data);
    else sendSuccess(res, data);
  }
}
