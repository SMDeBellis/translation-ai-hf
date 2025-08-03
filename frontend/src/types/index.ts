// Core application types

export interface Message {
  id: string;
  type: 'user' | 'bot' | 'system';
  message: string;
  timestamp: string;
}

export interface Conversation {
  file: string;
  session_start: string;
  exchanges: number;
  model: string;
  file_size: number;
}

export interface ConnectionStatus {
  connected: boolean;
  session_id?: string;
  message?: string;
}

export interface ChatState {
  messages: Message[];
  isTyping: boolean;
  isConnected: boolean;
  currentConversation?: string;
}

export interface AppSettings {
  ollamaHost: string;
  model: string;
  theme: 'light' | 'dark';
}

export interface SocketEvents {
  // Client to server
  send_message: { message: string };
  new_conversation: void;
  load_conversation: { filename: string };
  
  // Server to client
  user_message: { message: string; timestamp: string };
  bot_message: { message: string; timestamp: string };
  system_message: { message: string; timestamp: string };
  connection_status: ConnectionStatus;
  conversation_cleared: { message: string; timestamp: string };
  conversation_loaded: { 
    messages: Array<{ type: string; message: string; timestamp: string }>;
    filename: string;
    count: number;
  };
  error: { message: string };
}

export interface ApiResponse<T = any> {
  data?: T;
  error?: string;
  status: number;
}

export interface ConversationData {
  messages: Array<{
    user: string;
    bot: string;
    timestamp: string;
  }>;
  session_start: string;
  model: string;
}

export interface GrammarNotesResponse {
  content: string;
  exists: boolean;
  message?: string;
  file_size?: number;
}

// Authentication types
export interface User {
  id: number;
  email: string;
  display_name: string;
  provider: 'email' | 'google' | 'facebook';
  profile_picture_url?: string;
  created_at: string;
  user_directory_id: string;
}

export interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  loading: boolean;
}

export interface LoginCredentials {
  email: string;
  password: string;
  remember_me?: boolean;
}

export interface RegisterCredentials {
  email: string;
  password: string;
  display_name?: string;
}