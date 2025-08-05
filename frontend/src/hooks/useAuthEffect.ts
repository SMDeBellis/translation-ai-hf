import { useEffect, useRef } from 'react';
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
  const previousUserIdRef = useRef<number | null>(null);
  const hasInitializedRef = useRef(false);

  useEffect(() => {
    const currentUserId = authState.user?.id;
    const previousUserId = previousUserIdRef.current;

    // Only clear data when user actually changes, not on initial load
    if (hasInitializedRef.current && currentUserId && currentUserId !== previousUserId) {
      clearMessages();
      setCurrentConversation(undefined);
      console.log(`🔐 User changed from ${previousUserId} to ${currentUserId} (${authState.user.email}) - cleared chat data for privacy`);
    }

    // Update the previous user ID reference
    previousUserIdRef.current = currentUserId || null;
    
    // Mark as initialized after first run
    if (!hasInitializedRef.current) {
      hasInitializedRef.current = true;
      console.log(`🔐 Auth effect initialized for user ${currentUserId} (${authState.user?.email})`);
    }
  }, [authState.user?.id, authState.user?.email, clearMessages, setCurrentConversation]);

  // Additional effect for logout specifically
  useEffect(() => {
    if (!authState.isAuthenticated && !authState.loading && hasInitializedRef.current) {
      // User is logged out and not in a loading state
      clearMessages();
      setCurrentConversation(undefined);
      
      // Disconnect WebSocket to ensure clean state
      socketService.disconnect();
      
      // Reset initialization state
      hasInitializedRef.current = false;
      previousUserIdRef.current = null;
      
      console.log('🚪 User logged out - cleared all chat data and WebSocket connection');
    }
  }, [authState.isAuthenticated, authState.loading, clearMessages, setCurrentConversation]);
};