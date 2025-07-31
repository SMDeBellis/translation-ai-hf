import { io, Socket } from 'socket.io-client';
import type { SocketEvents } from '@/types';

class SocketService {
  private socket: Socket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;

  connect(): Socket {
    if (this.socket?.connected) {
      console.log('♻️  Reusing existing WebSocket connection:', this.socket.id);
      return this.socket;
    }

    if (this.socket && !this.socket.connected) {
      console.log('🔄 Reconnecting existing socket...');
      this.socket.connect();
      return this.socket;
    }

    console.log('🔗 Creating new WebSocket connection...');
    
    this.socket = io('/', {
      transports: ['websocket', 'polling'],
      upgrade: true,
      rememberUpgrade: true,
    });

    this.setupEventListeners();
    return this.socket;
  }

  disconnect(): void {
    if (this.socket) {
      console.log('Disconnecting from WebSocket server...');
      this.socket.disconnect();
      this.socket = null;
    }
  }

  emit<K extends keyof SocketEvents>(event: K, data: SocketEvents[K]): void {
    if (this.socket?.connected) {
      console.log(`SocketService - Emitting event: ${event}`, data);
      this.socket.emit(event, data);
    } else {
      console.warn(`Cannot emit ${event}: socket not connected`);
    }
  }

  on<K extends keyof SocketEvents>(
    event: K,
    callback: (data: SocketEvents[K]) => void
  ): void {
    if (this.socket) {
      console.log(`SocketService - Registering listener for event: ${event}`);
      // Add a wrapper to debug the callback
      const wrappedCallback = (data: any) => {
        console.log(`🎯 Event '${event}' callback triggered with data:`, data);
        callback(data);
      };
      this.socket.on(event as string, wrappedCallback);
    }
  }

  off<K extends keyof SocketEvents>(
    event: K,
    callback?: (data: SocketEvents[K]) => void
  ): void {
    if (this.socket) {
      this.socket.off(event as string, callback);
    }
  }

  private setupEventListeners(): void {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('✅ Connected to WebSocket server with session ID:', this.socket?.id);
      this.reconnectAttempts = 0;
    });

    this.socket.on('disconnect', (reason) => {
      console.log('❌ Disconnected from WebSocket server:', reason, 'Session ID was:', this.socket?.id);
      
      if (reason === 'io server disconnect') {
        // Server initiated disconnect, reconnect manually
        this.attemptReconnect();
      }
    });

    this.socket.on('connect_error', (error) => {
      console.error('🔥 WebSocket connection error:', error);
      this.attemptReconnect();
    });

    this.socket.on('error', (error) => {
      console.error('🔥 WebSocket error:', error);
    });

    // Debug: Log all incoming events
    this.socket.onAny((event, ...args) => {
      console.log(`🔄 Received WebSocket event '${event}' on session ${this.socket?.id}:`, args);
    });
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts}) in ${this.reconnectDelay}ms...`);
      
      setTimeout(() => {
        if (this.socket && !this.socket.connected) {
          this.socket.connect();
        }
      }, this.reconnectDelay);
      
      // Exponential backoff
      this.reconnectDelay = Math.min(this.reconnectDelay * 2, 10000);
    } else {
      console.error('Max reconnection attempts reached');
    }
  }

  get isConnected(): boolean {
    return this.socket?.connected ?? false;
  }

  get id(): string | undefined {
    return this.socket?.id;
  }
}

// Create singleton instance
export const socketService = new SocketService();
export default socketService;