import 'dotenv/config';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { app } from './app.js';
import { env } from './config/env.js';
import { setupMultiplayerSockets } from './sockets/multiplayer.socket.js';

const httpServer = createServer(app);

// Socket.IO comparte el mismo servidor HTTP que Express.
const io = new Server(httpServer, {
    cors: {
        origin: env.corsOrigins,
        methods: ['GET', 'POST'],
        credentials: true,
    },
});

setupMultiplayerSockets(io);

process.on('unhandledRejection', (reason) => {
    console.error('💥 Promesa rechazada no manejada:', reason);
});

process.on('uncaughtException', (err) => {
    console.error('💥 Excepción no capturada:', err);
});

const server = httpServer.listen(env.port, () => {
    console.log(`🚀 GuessVerse backend en http://localhost:${env.port}`);
});

// Apagado ordenado: deja de aceptar conexiones, cierra sockets y termina.
let shuttingDown = false;
function shutdown(signal: string) {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`\n${signal} recibido, cerrando servidor…`);

    io.close();
    server.close(() => process.exit(0));

    setTimeout(() => {
        console.error('⏱️ Cierre forzado tras 10s');
        process.exit(1);
    }, 10_000).unref();
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.on(signal, () => shutdown(signal));
}
