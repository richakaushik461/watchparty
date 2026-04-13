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
    const SERVER_URL =
      import.meta.env.VITE_SERVER_URL ||
      'https://watchparty-backend-2w8d.onrender.com';

    console.log('📡 Connecting to:', SERVER_URL);

    const newSocket = io(SERVER_URL, {
      transports: ['websocket','pooling'], // 🔥 MUST MATCH BACKEND
      withCredentials: false,
    });

    newSocket.on('connect', () => {
      console.log('✅ Connected:', newSocket.id);
      setIsConnected(true);
    });

    newSocket.on('connect_error', (error) => {
      console.error('❌ Error:', error.message);
      setIsConnected(false);
    });

    newSocket.on('disconnect', () => {
      console.log('🔌 Disconnected');
      setIsConnected(false);
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, []);

  return (
    <SocketContext.Provider value={{ socket, isConnected }}>
      {children}
    </SocketContext.Provider>
  );
};