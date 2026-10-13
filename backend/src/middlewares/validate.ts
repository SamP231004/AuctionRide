import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { z, ZodTypeAny } from 'zod';

export interface RequestSchemas {
  body?: ZodTypeAny;
  params?: ZodTypeAny;
  query?: ZodTypeAny;
}

type Inferred<S extends ZodTypeAny | undefined> = S extends ZodTypeAny ? z.output<S> : undefined;

export interface ValidatedInput<S extends RequestSchemas> {
  body: Inferred<S['body']>;
  params: Inferred<S['params']>;
  query: Inferred<S['query']>;
}

/**
 * Parses body / params / query with zod and stores the *transformed* output on `req.validated`.
 * Any failure is forwarded to the error middleware as a ZodError → 400 VALIDATION_ERROR.
 */
export function validate(schemas: RequestSchemas): RequestHandler {
  return async (req: Request, _res: Response, next: NextFunction) => {
    const parse = (schema: ZodTypeAny | undefined, input: unknown): Promise<unknown> =>
      schema ? schema.parseAsync(input) : Promise.resolve(undefined);
    const [body, params, query] = await Promise.all([
      parse(schemas.body, req.body ?? {}),
      parse(schemas.params, req.params),
      parse(schemas.query, req.query),
    ]);
    req.validated = { body, params, query };
    next();
  };
}

/**
 * Typed accessor for validated input. Passing the same schema object used in the route ties the
 * controller's types to the runtime validation.
 */
export function getValidated<S extends RequestSchemas>(req: Request, _schemas: S): ValidatedInput<S> {
  if (!req.validated) {
    throw new Error('getValidated() called on a route without the validate() middleware');
  }
  return req.validated as ValidatedInput<S>;
}
