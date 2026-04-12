import React, { createContext, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  connectionType: string | null;
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false,
  connectionType: null,
});

export const useSocket = () => useContext(SocketContext);

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionType, setConnectionType] = useState<string | null>(null);

  useEffect(() => {
    // Use production URL with fallback
    const serverUrl = import.meta.env.VITE_SERVER_URL || 'https://watchparty-backend-2w8d.onrender.com';
    
    console.log('📡 Connecting to server:', serverUrl);
    
    // Solution 3: Try polling first for mobile compatibility
    const newSocket = io(serverUrl, {
      transports: ['polling', 'websocket'], // POLLING FIRST for mobile
      upgrade: true,
      rememberUpgrade: true,
      secure: true,
      rejectUnauthorized: false,
      reconnection: true,
      reconnectionAttempts: 20, // Increased for mobile
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
      timeout: 30000, // Longer timeout for mobile networks
      autoConnect: true,
      forceNew: true,
      path: '/socket.io',
      withCredentials: true,
    });

    // Track connection type
    newSocket.on('connect', () => {
      console.log('✅ Socket connected successfully');
      console.log('📶 Transport:', newSocket.io.engine.transport.name);
      setConnectionType(newSocket.io.engine.transport.name);
      setIsConnected(true);
    });

    newSocket.on('upgrade', (transport) => {
      console.log('⬆️ Transport upgraded to:', transport.name);
      setConnectionType(transport.name);
    });

    newSocket.on('upgradeError', (error) => {
      console.warn('⚠️ Transport upgrade failed:', error);
    });

    newSocket.on('connect_error', (error) => {
      console.error('❌ Socket connection error:', error.message);
      console.log('🔍 Error details:', error);
      setIsConnected(false);
    });

    newSocket.on('disconnect', (reason) => {
      console.log('🔌 Socket disconnected:', reason);
      setIsConnected(false);
      
      // Special handling for mobile disconnections
      if (reason === 'transport close' || reason === 'ping timeout') {
        console.log('🔄 Mobile network issue - attempting reconnect...');
      }
    });

    newSocket.on('reconnect_attempt', (attemptNumber) => {
      console.log(`🔄 Reconnect attempt ${attemptNumber}`);
    });

    newSocket.on('reconnect', (attemptNumber) => {
      console.log('✅ Socket reconnected after', attemptNumber, 'attempts');
      console.log('📶 Current transport:', newSocket.io.engine.transport.name);
      setConnectionType(newSocket.io.engine.transport.name);
      setIsConnected(true);
    });

    newSocket.on('reconnect_error', (error) => {
      console.error('❌ Socket reconnection error:', error.message);
    });

    newSocket.on('reconnect_failed', () => {
      console.error('❌ Socket reconnection failed after all attempts');
      console.log('💡 Tip: Try refreshing the page or checking your network');
    });

    // Ping to keep connection alive on mobile
    const pingInterval = setInterval(() => {
      if (newSocket.connected) {
        newSocket.emit('ping');
      }
    }, 20000);

    setSocket(newSocket);

    return () => {
      console.log('🔚 Closing socket connection');
      clearInterval(pingInterval);
      newSocket.off('connect');
      newSocket.off('disconnect');
      newSocket.off('reconnect');
      newSocket.close();
    };
  }, []);

  // Show connection status in console for debugging
  useEffect(() => {
    if (isConnected) {
      console.log('🎉 Ready to create/join rooms!');
    }
  }, [isConnected]);

  return (
    <SocketContext.Provider value={{ socket, isConnected, connectionType }}>
      {children}
    </SocketContext.Provider>
  );
};