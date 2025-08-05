import React, { createContext, useContext, useReducer, useEffect, useCallback, ReactNode } from 'react';
import type { ChatState, AppSettings, Message } from '@/types';
import { generateId } from '@/utils';

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

  // Chat actions - use useCallback to create stable references
  const addMessage = useCallback((message: Omit<Message, 'id'>) => {
    chatDispatch({
      type: 'ADD_MESSAGE',
      payload: {
        ...message,
        id: generateId(),
      },
    });
  }, []);

  const setTyping = useCallback((isTyping: boolean) => {
    chatDispatch({ type: 'SET_TYPING', payload: isTyping });
  }, []);

  const setConnectionStatus = useCallback((isConnected: boolean) => {
    chatDispatch({ type: 'SET_CONNECTION_STATUS', payload: isConnected });
  }, []);

  const clearMessages = useCallback(() => {
    chatDispatch({ type: 'CLEAR_MESSAGES' });
  }, []);

  const loadMessages = useCallback((messages: Message[]) => {
    chatDispatch({ type: 'LOAD_MESSAGES', payload: messages });
  }, []);

  const setCurrentConversation = useCallback((filename: string | undefined) => {
    chatDispatch({ type: 'SET_CURRENT_CONVERSATION', payload: filename });
    
    // Update localStorage with the active conversation
    if (filename) {
      localStorage.setItem('spanish-tutor-active-conversation', filename);
    } else {
      localStorage.removeItem('spanish-tutor-active-conversation');
    }
  }, []);

  // Settings actions
  const updateSettings = useCallback((newSettings: Partial<AppSettings>) => {
    settingsDispatch({ type: 'UPDATE_SETTINGS', payload: newSettings });
  }, []);

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