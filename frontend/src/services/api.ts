import axios, { AxiosResponse, AxiosError } from 'axios';
import type { 
  ApiResponse, 
  Conversation, 
  ConversationData, 
  GrammarNotesResponse 
} from '@/types';

// Create axios instance with default config
const api = axios.create({
  baseURL: '/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
api.interceptors.request.use(
  (config) => {
    console.log(`API Request: ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => {
    console.error('API Request Error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor
api.interceptors.response.use(
  (response: AxiosResponse) => {
    console.log(`API Response: ${response.status} ${response.config.url}`);
    return response;
  },
  (error: AxiosError) => {
    console.error('API Response Error:', error.response?.status, error.message);
    return Promise.reject(error);
  }
);

// API methods
export const apiService = {
  // Health check
  async healthCheck(): Promise<ApiResponse> {
    try {
      const response = await api.get('/health');
      return { data: response.data, status: response.status };
    } catch (error) {
      const axiosError = error as AxiosError;
      return {
        error: axiosError.message,
        status: axiosError.response?.status || 500,
      };
    }
  },

  // Ollama status
  async getOllamaStatus(): Promise<ApiResponse> {
    try {
      const response = await api.get('/ollama/status');
      return { data: response.data, status: response.status };
    } catch (error) {
      const axiosError = error as AxiosError;
      return {
        error: axiosError.message,
        status: axiosError.response?.status || 500,
      };
    }
  },

  // Conversations
  async getConversations(): Promise<ApiResponse<{conversations: Conversation[]; count: number}>> {
    try {
      const response = await api.get('/conversations/list');
      return { data: response.data, status: response.status };
    } catch (error) {
      const axiosError = error as AxiosError;
      return {
        error: axiosError.message,
        status: axiosError.response?.status || 500,
      };
    }
  },

  async getLatestConversation(): Promise<ApiResponse<{exists: boolean; filename?: string; session_start?: string; exchanges?: number; conversation?: any[]; user_id?: string; message?: string}>> {
    try {
      const response = await api.get('/conversations/latest');
      return { data: response.data, status: response.status };
    } catch (error) {
      const axiosError = error as AxiosError;
      return {
        error: axiosError.message,
        status: axiosError.response?.status || 500,
      };
    }
  },

  async getConversation(filename: string): Promise<ApiResponse<ConversationData>> {
    try {
      const response = await api.get(`/conversations/${encodeURIComponent(filename)}`);
      return { data: response.data, status: response.status };
    } catch (error) {
      const axiosError = error as AxiosError;
      return {
        error: axiosError.message,
        status: axiosError.response?.status || 500,
      };
    }
  },

  // Grammar notes
  async getGrammarNotes(): Promise<ApiResponse<GrammarNotesResponse>> {
    try {
      const response = await api.get('/grammar-notes');
      return { data: response.data, status: response.status };
    } catch (error) {
      const axiosError = error as AxiosError;
      return {
        error: axiosError.message,
        status: axiosError.response?.status || 500,
      };
    }
  },

  async exportGrammarNotes(): Promise<void> {
    try {
      const response = await api.get('/grammar-notes/export', {
        responseType: 'blob',
      });
      
      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `spanish_grammar_notes_${new Date().toISOString().split('T')[0]}.md`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export grammar notes:', error);
      throw error;
    }
  },
};

export default apiService;