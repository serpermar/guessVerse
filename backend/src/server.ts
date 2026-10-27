import 'dotenv/config';
import { app } from './app.js';
import { env } from './config/env.js';

const server = app.listen(env.port, () => {
    console.log(`🚀 GuessVerse backend en http://localhost:${env.port}`);
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.on(signal, () => {
        console.log(`\n${signal} recibido, cerrando servidor…`);
        server.close(() => process.exit(0));
    });
}