import { io } from 'socket.io-client';
import { supabase } from './supabase';

const SOCKET_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

// autoConnect: false para conectarnos solo cuando entremos al Lobby o a una partida.
export const socket = io(SOCKET_URL, {
    autoConnect: false,
    withCredentials: true,
});

/**
 * Conecta el socket enviando el access token de Supabase en el handshake.
 * El servidor valida el JWT y deriva el usuario; nunca confiamos en un userId
 * enviado por el cliente en los eventos.
 */
export async function connectSocket(): Promise<void> {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error || !session?.access_token) {
        throw new Error('Necesitas iniciar sesión para jugar en línea');
    }

    socket.auth = { token: session.access_token };
    if (!socket.connected) socket.connect();
}
