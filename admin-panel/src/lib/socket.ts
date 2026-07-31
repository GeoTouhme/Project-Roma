import { io, Socket } from 'socket.io-client';
import { API_URL } from './api';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(API_URL, {
      withCredentials: true,
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
      path: '/socket.io/',
    });

    socket.on('connect', () => {
      console.log('Admin socket connected');
    });

    socket.on('connect_error', (err) => {
      console.warn('Admin socket connection error:', err.message);
    });

    socket.on('disconnect', (reason) => {
      console.log('Admin socket disconnected:', reason);
    });
  }

  return socket;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export function isSocketConnected(): boolean {
  return socket?.connected ?? false;
}

export function onNotificationNew(callback: (notification: any) => void): () => void {
  const s = getSocket();
  s.on('notification:new', callback);
  return () => {
    s.off('notification:new', callback);
  };
}
