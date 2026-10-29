import 'dotenv/config';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { app } from './app.js';
import { env } from './config/env.js';
import { discoverRouter } from './routes/discover.routes.js';
import { setupMultiplayerSockets } from './sockets/multiplayer.socket.js';

app.use('/api/discover', discoverRouter);

const httpServer = createServer(app);

// CORS específico para Socket.IO
const io = new Server(httpServer, {
    cors: {
        origin: env.corsOrigins || "*", // Usa "*" si estás en desarrollo para evitar bloqueos
        methods: ['GET', 'POST'],
        credentials: true
    }
});

setupMultiplayerSockets(io);

const server = httpServer.listen(env.port, () => {
    console.log(`🚀 GuessVerse backend en http://localhost:${env.port}`);
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.on(signal, () => {
        console.log(`\n${signal} recibido, cerrando servidor…`);
        server.close(() => process.exit(0));
    });
}