import { useEffect, useRef, useCallback } from 'react';
import { Socket } from 'socket.io-client';
import { socketService } from '@/services/socket';
import type { SocketEvents } from '@/types';

export const useSocket = () => {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    socketRef.current = socketService.connect();

    return () => {
      // Don't disconnect on unmount as other components might be using it
      // socketService.disconnect();
    };
  }, []);

  const emit = useCallback(<K extends keyof SocketEvents>(
    event: K, 
    data: SocketEvents[K]
  ) => {
    socketService.emit(event, data);
  }, []);

  const on = useCallback(<K extends keyof SocketEvents>(
    event: K,
    callback: (data: SocketEvents[K]) => void
  ) => {
    socketService.on(event, callback);
    
    // Return cleanup function
    return () => {
      socketService.off(event, callback);
    };
  }, []);

  return {
    socket: socketRef.current,
    emit,
    on,
    isConnected: socketService.isConnected,
    id: socketService.id,
  };
};

export default useSocket;