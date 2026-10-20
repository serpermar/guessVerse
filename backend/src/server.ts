import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { env } from './config/env.js';
import { debugRouter } from './routes/debug.routes.js';
import { themesRouter } from './routes/themes.routes.js';
import { importRouter } from './routes/import.routes.js';
import { gamesRouter } from './routes/games.routes.js';

const app = express();

app.use(cors());
app.use(express.json());
app.use('/api/themes', themesRouter);
app.use('/api/import', importRouter);
app.use('/api/games', gamesRouter);

app.get('/api/health', (_req, res) => {
    res.json({
        status: 'ok',
        service: 'guessverse-backend',
        timestamp: new Date().toISOString(),
        env: env.nodeEnv,
    });
});

// Solo en desarrollo
if (env.nodeEnv !== 'production') {
    app.use('/api/debug', debugRouter);
    app.use('/api/import', importRouter);
    app.use('/api/games', gamesRouter);
}

// Middleware centralizado de errores (al final, siempre)
app.use(
    (
        err: Error,
        _req: express.Request,
        res: express.Response,
        _next: express.NextFunction
    ) => {
        console.error('💥', err.message);
        res.status(500).json({ error: err.message });
    }
);

app.listen(env.port, () => {
    console.log(`🚀 GuessVerse backend en http://localhost:${env.port}`);
});