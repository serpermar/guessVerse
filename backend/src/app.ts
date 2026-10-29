import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { env } from './config/env.js';
import { debugRouter } from './routes/debug.routes.js';
import { themesRouter } from './routes/themes.routes.js';
import { importRouter } from './routes/import.routes.js';
import { gamesRouter } from './routes/games.routes.js';
import { questionsRouter } from './routes/questions.routes.js';
import { errorHandler, notFoundHandler } from './middleware/error.middleware.js';
import { usersRouter } from './routes/users.routes.js';
import { discoverRouter } from './routes/discover.routes.js';
import { charactersRouter } from './routes/characters.routes.js';

export const app = express();

app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(helmet());
app.use(
    cors({
        origin: env.corsOrigins,
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Import-Token'],
    })
);
app.use(express.json({ limit: '100kb' }));

// Rate limit global razonable; las rutas críticas añaden límites propios.
app.use(
    rateLimit({
        windowMs: 60_000,
        limit: 120,
        standardHeaders: 'draft-7',
        legacyHeaders: false,
    })
);

app.use('/api/themes', themesRouter);
app.use('/api/themes', questionsRouter);
app.use('/api/games', gamesRouter);
app.use('/api/users', usersRouter);
app.use('/api/discover', discoverRouter);
app.use('/api/characters', charactersRouter);
app.get('/api/health', (_req, res) => {
    res.json({
        status: 'ok',
        service: 'guessverse-backend',
        timestamp: new Date().toISOString(),
        env: env.nodeEnv,
    });
});

// Rutas de desarrollo/importación: NUNCA en producción.
if (!env.isProduction) {
    app.use('/api/debug', debugRouter);
    app.use('/api/import', importRouter);
}

app.use(notFoundHandler);
app.use(errorHandler);
