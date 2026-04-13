import React, { createContext, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false,
});

export const useSocket = () => useContext(SocketContext);

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // 🔥 Your deployed backend URL
    const SERVER_URL =
      import.meta.env.VITE_SERVER_URL ||
      'https://watchparty-backend-2w8d.onrender.com';

    console.log('📡 Connecting to:', SERVER_URL);

    const newSocket = io(SERVER_URL, {
      transports: ['websocket'], // ✅ BEST for production
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      timeout: 20000,
    });

    // ✅ Connected
    newSocket.on('connect', () => {
      console.log('✅ Connected:', newSocket.id);
      setIsConnected(true);
    });

    // ❌ Connection error
    newSocket.on('connect_error', (error) => {
      console.error('❌ Connection error:', error.message);
      setIsConnected(false);
    });

    // 🔌 Disconnected
    newSocket.on('disconnect', (reason) => {
      console.log('🔌 Disconnected:', reason);
      setIsConnected(false);
    });

    // 🔄 Reconnected
    newSocket.on('reconnect', (attempt) => {
      console.log('🔄 Reconnected after', attempt, 'attempts');
      setIsConnected(true);
    });

    setSocket(newSocket);

    return () => {
      console.log('🔚 Closing socket');
      newSocket.close();
    };
  }, []);

  return (
    <SocketContext.Provider value={{ socket, isConnected }}>
      {children}
    </SocketContext.Provider>
  );
};