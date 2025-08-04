import { useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useAppContext } from '@/context/AppContext';
import { socketService } from '@/services/socket';

/**
 * Hook to handle side effects when authentication state changes
 * Clears chat data when users login/logout to ensure proper privacy isolation
 */
export const useAuthEffect = () => {
  const { authState } = useAuth();
  const { clearMessages, setCurrentConversation } = useAppContext();

  useEffect(() => {
    // Clear chat data whenever the user changes
    // This ensures conversations are not shared between different users
    if (authState.user?.id) {
      clearMessages();
      setCurrentConversation(undefined);
      console.log(`🔐 User changed to ${authState.user.email} - cleared chat data for privacy`);
    }
  }, [authState.user?.id, authState.user?.email, clearMessages, setCurrentConversation]);

  // Additional effect for logout specifically
  useEffect(() => {
    if (!authState.isAuthenticated && !authState.loading) {
      // User is logged out and not in a loading state
      clearMessages();
      setCurrentConversation(undefined);
      
      // Disconnect WebSocket to ensure clean state
      socketService.disconnect();
      
      console.log('🚪 User logged out - cleared all chat data and WebSocket connection');
    }
  }, [authState.isAuthenticated, authState.loading, clearMessages, setCurrentConversation]);
};