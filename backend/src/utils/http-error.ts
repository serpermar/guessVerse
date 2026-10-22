/**
 * Error con código HTTP explícito. Los errores que lleguen al middleware
 * centralizado sin ser HttpError se tratan como 500.
 */
export class HttpError extends Error {
    readonly status: number;

    constructor(status: number, message: string) {
        super(message);
        this.name = 'HttpError';
        this.status = status;
    }

    static badRequest(message: string): HttpError {
        return new HttpError(400, message);
    }

    static notFound(message: string): HttpError {
        return new HttpError(404, message);
    }

    static conflict(message: string): HttpError {
        return new HttpError(409, message);
    }

    static forbidden(message = 'Acceso denegado'): HttpError {
        return new HttpError(403, message);
    }
}
