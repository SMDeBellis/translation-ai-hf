import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import type { AuthState, User, LoginCredentials, RegisterCredentials } from '@/types';
import { authService } from '@/services/auth';
import { showToast } from '@/utils';

// Initial state
const initialAuthState: AuthState = {
  isAuthenticated: false,
  user: null,
  loading: true,
};

// Action types
type AuthAction =
  | { type: 'LOGIN_START' }
  | { type: 'LOGIN_SUCCESS'; payload: User }
  | { type: 'LOGIN_FAILURE' }
  | { type: 'LOGOUT' }
  | { type: 'SET_LOADING'; payload: boolean };

// Reducer
const authReducer = (state: AuthState, action: AuthAction): AuthState => {
  console.log('authReducer - action:', action.type, 'payload' in action ? action.payload : 'no payload');
  
  switch (action.type) {
    case 'LOGIN_START':
      return {
        ...state,
        loading: true,
      };
    case 'LOGIN_SUCCESS':
      return {
        ...state,
        isAuthenticated: true,
        user: action.payload,
        loading: false,
      };
    case 'LOGIN_FAILURE':
      return {
        ...state,
        isAuthenticated: false,
        user: null,
        loading: false,
      };
    case 'LOGOUT':
      return {
        ...state,
        isAuthenticated: false,
        user: null,
        loading: false,
      };
    case 'SET_LOADING':
      return {
        ...state,
        loading: action.payload,
      };
    default:
      return state;
  }
};

// Context type
interface AuthContextType {
  authState: AuthState;
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (credentials: RegisterCredentials) => Promise<void>;
  googleLogin: (idToken: string) => Promise<void>;
  facebookLogin: (accessToken: string) => Promise<void>;
  logout: () => Promise<void>;
  checkAuthStatus: () => Promise<void>;
}

// Create context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Provider component
interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [authState, authDispatch] = useReducer(authReducer, initialAuthState);

  // Check authentication status on mount
  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      authDispatch({ type: 'SET_LOADING', payload: true });
      const status = await authService.getAuthStatus();
      
      if (status.authenticated && status.user) {
        authDispatch({ type: 'LOGIN_SUCCESS', payload: status.user });
      } else {
        authDispatch({ type: 'LOGIN_FAILURE' });
      }
    } catch (error) {
      console.error('Auth status check failed:', error);
      authDispatch({ type: 'LOGIN_FAILURE' });
    }
  };

  const login = async (credentials: LoginCredentials) => {
    try {
      authDispatch({ type: 'LOGIN_START' });
      const result = await authService.login(credentials);
      
      authDispatch({ type: 'LOGIN_SUCCESS', payload: result.user });
      showToast(result.message || 'Login successful', 'success');
    } catch (error: any) {
      authDispatch({ type: 'LOGIN_FAILURE' });
      showToast(error.message || 'Login failed', 'error');
      throw error;
    }
  };

  const register = async (credentials: RegisterCredentials) => {
    try {
      authDispatch({ type: 'LOGIN_START' });
      const result = await authService.register(credentials);
      
      authDispatch({ type: 'LOGIN_SUCCESS', payload: result.user });
      showToast(result.message || 'Registration successful', 'success');
    } catch (error: any) {
      authDispatch({ type: 'LOGIN_FAILURE' });
      showToast(error.message || 'Registration failed', 'error');
      throw error;
    }
  };

  const googleLogin = async (idToken: string) => {
    try {
      authDispatch({ type: 'LOGIN_START' });
      const result = await authService.googleLogin(idToken);
      
      authDispatch({ type: 'LOGIN_SUCCESS', payload: result.user });
      showToast(result.message || 'Google login successful', 'success');
    } catch (error: any) {
      authDispatch({ type: 'LOGIN_FAILURE' });
      showToast(error.message || 'Google login failed', 'error');
      throw error;
    }
  };

  const facebookLogin = async (accessToken: string) => {
    try {
      authDispatch({ type: 'LOGIN_START' });
      const result = await authService.facebookLogin(accessToken);
      
      authDispatch({ type: 'LOGIN_SUCCESS', payload: result.user });
      showToast(result.message || 'Facebook login successful', 'success');
    } catch (error: any) {
      authDispatch({ type: 'LOGIN_FAILURE' });
      showToast(error.message || 'Facebook login failed', 'error');
      throw error;
    }
  };

  const logout = async () => {
    try {
      await authService.logout();
      authDispatch({ type: 'LOGOUT' });
      showToast('Logged out successfully', 'success');
    } catch (error: any) {
      console.error('Logout error:', error);
      // Still logout on client side even if server call fails
      authDispatch({ type: 'LOGOUT' });
      showToast('Logged out', 'success');
    }
  };

  const contextValue: AuthContextType = {
    authState,
    login,
    register,
    googleLogin,
    facebookLogin,
    logout,
    checkAuthStatus,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook to use the context
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;