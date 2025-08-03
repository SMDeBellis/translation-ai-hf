import React, { createContext, useContext, useReducer, useEffect, ReactNode, useRef } from 'react';
import type { ChatState, AppSettings, Message } from '@/types';
import { generateId, showToast } from '@/utils';
import { socketService } from '@/services/socket';

// Initial state
const initialChatState: ChatState = {
  messages: [],
  isTyping: false,
  isConnected: false,
  currentConversation: undefined,
};

const initialSettings: AppSettings = {
  ollamaHost: 'localhost:11434',
  model: 'llama3',
  theme: 'light',
};

// Action types
type ChatAction =
  | { type: 'ADD_MESSAGE'; payload: Message }
  | { type: 'SET_TYPING'; payload: boolean }
  | { type: 'SET_CONNECTION_STATUS'; payload: boolean }
  | { type: 'CLEAR_MESSAGES' }
  | { type: 'LOAD_MESSAGES'; payload: Message[] }
  | { type: 'SET_CURRENT_CONVERSATION'; payload: string | undefined };

type SettingsAction =
  | { type: 'UPDATE_SETTINGS'; payload: Partial<AppSettings> };

// Reducers
const chatReducer = (state: ChatState, action: ChatAction): ChatState => {
  console.log('chatReducer - action:', action.type, 'payload' in action ? action.payload : 'no payload');
  
  switch (action.type) {
    case 'ADD_MESSAGE':
      console.log('chatReducer - ADD_MESSAGE, new count:', state.messages.length + 1);
      return {
        ...state,
        messages: [...state.messages, action.payload],
      };
    case 'SET_TYPING':
      return {
        ...state,
        isTyping: action.payload,
      };
    case 'SET_CONNECTION_STATUS':
      return {
        ...state,
        isConnected: action.payload,
      };
    case 'CLEAR_MESSAGES':
      console.log('🧹 chatReducer - CLEAR_MESSAGES, previous count:', state.messages.length);
      const clearedState = {
        ...state,
        messages: [],
      };
      console.log('🧹 chatReducer - CLEAR_MESSAGES complete, new count:', clearedState.messages.length);
      return clearedState;
    case 'LOAD_MESSAGES':
      console.log('📥 chatReducer - LOAD_MESSAGES, incoming count:', action.payload.length);
      console.log('📥 chatReducer - LOAD_MESSAGES, current state count:', state.messages.length);
      console.log('📥 chatReducer - LOAD_MESSAGES, first message:', action.payload[0]);
      const loadedState = {
        ...state,
        messages: action.payload,
      };
      console.log('📥 chatReducer - LOAD_MESSAGES complete, final count:', loadedState.messages.length);
      return loadedState;
    case 'SET_CURRENT_CONVERSATION':
      return {
        ...state,
        currentConversation: action.payload,
      };
    default:
      return state;
  }
};

const settingsReducer = (state: AppSettings, action: SettingsAction): AppSettings => {
  switch (action.type) {
    case 'UPDATE_SETTINGS':
      return {
        ...state,
        ...action.payload,
      };
    default:
      return state;
  }
};

// Context type
interface AppContextType {
  // Chat state and actions
  chatState: ChatState;
  addMessage: (message: Omit<Message, 'id'>) => void;
  setTyping: (isTyping: boolean) => void;
  setConnectionStatus: (isConnected: boolean) => void;
  clearMessages: () => void;
  loadMessages: (messages: Message[]) => void;
  setCurrentConversation: (filename: string | undefined) => void;
  
  // Settings state and actions
  settings: AppSettings;
  updateSettings: (settings: Partial<AppSettings>) => void;
}

// Create context
const AppContext = createContext<AppContextType | undefined>(undefined);

// Provider component
interface AppProviderProps {
  children: ReactNode;
}

export const AppProvider: React.FC<AppProviderProps> = ({ children }) => {
  const [chatState, chatDispatch] = useReducer(chatReducer, initialChatState);
  const [settings, settingsDispatch] = useReducer(settingsReducer, initialSettings);

  // Load settings from localStorage on mount
  useEffect(() => {
    const savedSettings = localStorage.getItem('spanish-tutor-settings');
    if (savedSettings) {
      try {
        const parsedSettings = JSON.parse(savedSettings);
        settingsDispatch({ type: 'UPDATE_SETTINGS', payload: parsedSettings });
      } catch (error) {
        console.error('Failed to load settings from localStorage:', error);
      }
    }
  }, []);

  // Save settings to localStorage when they change
  useEffect(() => {
    localStorage.setItem('spanish-tutor-settings', JSON.stringify(settings));
  }, [settings]);

  // Chat actions
  const addMessage = (message: Omit<Message, 'id'>) => {
    chatDispatch({
      type: 'ADD_MESSAGE',
      payload: {
        ...message,
        id: generateId(),
      },
    });
  };

  const setTyping = (isTyping: boolean) => {
    chatDispatch({ type: 'SET_TYPING', payload: isTyping });
  };

  const setConnectionStatus = (isConnected: boolean) => {
    chatDispatch({ type: 'SET_CONNECTION_STATUS', payload: isConnected });
  };

  const clearMessages = () => {
    chatDispatch({ type: 'CLEAR_MESSAGES' });
  };

  const loadMessages = (messages: Message[]) => {
    chatDispatch({ type: 'LOAD_MESSAGES', payload: messages });
  };

  const setCurrentConversation = (filename: string | undefined) => {
    chatDispatch({ type: 'SET_CURRENT_CONVERSATION', payload: filename });
  };

  // Settings actions
  const updateSettings = (newSettings: Partial<AppSettings>) => {
    settingsDispatch({ type: 'UPDATE_SETTINGS', payload: newSettings });
  };

  // Socket event listeners setup - moved here so they persist across page navigation
  const socketInitialized = useRef(false);
  
  useEffect(() => {
    if (socketInitialized.current) return;
    socketInitialized.current = true;
    
    console.log('🔗 Setting up socket listeners in AppProvider (persistent across navigation)');
    
    // Connect to socket
    const socket = socketService.connect();
    
    // Connection status
    const handleConnectionStatus = (data: any) => {
      setConnectionStatus(data.connected);
    };
    
    // User message confirmation
    const handleUserMessage = (_data: any) => {
      console.log('Message sent successfully');
    };
    
    // Bot response
    const handleBotMessage = (data: any) => {
      console.log('Received bot_message:', data);
      addMessage({
        type: 'bot',
        message: data.message,
        timestamp: data.timestamp,
      });
      setTyping(false);
    };
    
    // System messages
    const handleSystemMessage = (data: any) => {
      addMessage({
        type: 'system',
        message: data.message,
        timestamp: data.timestamp,
      });
    };
    
    // Conversation cleared
    const handleConversationCleared = (data: any) => {
      console.log('🧹 Received conversation_cleared event (AppProvider)');
      console.log('📊 Current messages count before clear:', chatState.messages.length);
      clearMessages();
      console.log('✅ Messages cleared - showing welcome message (AppProvider)');
      showToast('New conversation started', 'success');
    };
    
    // Conversation loaded
    const handleConversationLoaded = (data: any) => {
      console.log('🔄 Received conversation_loaded (AppProvider):', data);
      console.log('📨 Current state messages count before clear:', chatState.messages.length);
      console.log('📨 Raw messages from server:', data.messages);
      
      const messages = data.messages
        .filter((msg: any) => msg.message && msg.message.trim()) // Filter out empty messages
        .map((msg: any, index: number) => ({
          id: `loaded-${index}`,
          type: msg.type as 'user' | 'bot' | 'system',
          message: msg.message,
          timestamp: msg.timestamp,
        }));
      
      console.log('✅ Processed messages for loading:', messages.length, 'messages');
      console.log('✅ First few processed messages:', messages.slice(0, 3));
      
      // Clear existing messages first
      console.log('🧹 Clearing existing messages...');
      clearMessages();
      
      // Load new messages
      console.log('📥 Loading new messages...');
      loadMessages(messages);
      
      console.log('📊 State should now have', messages.length, 'messages');
      showToast(`Loaded conversation with ${data.count} exchanges`, 'success');
    };
    
    // Error handling
    const handleError = (data: any) => {
      console.error('Socket error:', data.message);
      showToast(data.message, 'error');
      setTyping(false);
    };
    
    // Register event listeners
    socketService.on('connection_status', handleConnectionStatus);
    socketService.on('user_message', handleUserMessage);
    socketService.on('bot_message', handleBotMessage);
    socketService.on('system_message', handleSystemMessage);
    socketService.on('conversation_cleared', handleConversationCleared);
    socketService.on('conversation_loaded', handleConversationLoaded);
    socketService.on('error', handleError);
    
    // Cleanup on unmount
    return () => {
      console.log('🧹 Cleaning up socket listeners (AppProvider unmount)');
      socketService.off('connection_status', handleConnectionStatus);
      socketService.off('user_message', handleUserMessage);
      socketService.off('bot_message', handleBotMessage);
      socketService.off('system_message', handleSystemMessage);
      socketService.off('conversation_cleared', handleConversationCleared);
      socketService.off('conversation_loaded', handleConversationLoaded);
      socketService.off('error', handleError);
    };
  }, []); // Empty dependency array so this only runs once

  const contextValue: AppContextType = {
    chatState,
    addMessage,
    setTyping,
    setConnectionStatus,
    clearMessages,
    loadMessages,
    setCurrentConversation,
    settings,
    updateSettings,
  };

  return (
    <AppContext.Provider value={contextValue}>
      {children}
    </AppContext.Provider>
  );
};

// Custom hook to use the context
export const useAppContext = (): AppContextType => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
};

export default AppContext;