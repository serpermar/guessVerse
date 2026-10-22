import 'dotenv/config';
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

const app = express();

app.disable('x-powered-by');
app.use(helmet());
app.use(
    cors({
        origin: env.corsOrigins,
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization'],
    })
);
app.use(express.json({ limit: '100kb' }));

// Rate limit global razonable; más estricto en creación de partidas.
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

const server = app.listen(env.port, () => {
    console.log(`🚀 GuessVerse backend en http://localhost:${env.port}`);
});

// Apagado ordenado
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.on(signal, () => {
        console.log(`\n${signal} recibido, cerrando servidor…`);
        server.close(() => process.exit(0));
    });
}
