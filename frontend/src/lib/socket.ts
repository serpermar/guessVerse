import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

// autoConnect: false para conectarnos solo cuando entremos al Lobby
export const socket = io(SOCKET_URL, {
    autoConnect: false,
    withCredentials: true,
});