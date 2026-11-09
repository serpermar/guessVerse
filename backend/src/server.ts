import 'dotenv/config';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { app } from './app.js';
import { env } from './config/env.js';
import { discoverRouter } from './routes/discover.routes.js';
import { setupMultiplayerSockets } from './sockets/multiplayer.socket.js';

// 1. Registrar la ruta de descubrimiento
app.use('/api/discover', discoverRouter);

// 2. Middleware de errores de Express
// NOTA: req y next son obligatorios en la firma aunque no se usen. Usamos '_' para evitar el warning.
app.use((err: any, _req: any, res: any, _next: any) => {
    console.error('💥 Error en el servidor Express:', err.message);
    res.status(500).json({ error: err.message || 'Error interno del servidor' });
});

const httpServer = createServer(app);

// 3. Configurar Socket.IO
const io = new Server(httpServer, {
    cors: {
        origin: env.corsOrigins || "*",
        methods: ['GET', 'POST'],
        credentials: true
    }
});

setupMultiplayerSockets(io);

// 4. EVITAR QUE EL SERVIDOR SE CAIGA
// Usamos '_promise' porque no lo necesitamos, solo el 'reason'
process.on('unhandledRejection', (reason, _promise) => {
    console.error('💥 Promesa rechazada no manejada:', reason);
});

process.on('uncaughtException', (err) => {
    console.error('💥 Excepción no capturada:', err);
});

// 5. Arrancar el servidor
const server = httpServer.listen(env.port, () => {
    console.log(`🚀 GuessVerse backend en http://localhost:${env.port}`);
});

// 6. Apagado ordenado
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.on(signal, () => {
        console.log(`\n${signal} recibido, cerrando servidor…`);
        server.close(() => process.exit(0));
    });
}