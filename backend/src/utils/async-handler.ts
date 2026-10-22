import type { NextFunction, Request, RequestHandler, Response } from 'express';

/**
 * Envuelve un handler async para reenviar cualquier rejection a Express.
 * Genérico sobre los params/body/query del Request.
 */
export function asyncHandler<P = Record<string, string>>(
    fn: (req: Request<P>, res: Response, next: NextFunction) => Promise<unknown>
): RequestHandler<P> {
    return (req, res, next) => {
        fn(req, res, next).catch(next);
    };
}
