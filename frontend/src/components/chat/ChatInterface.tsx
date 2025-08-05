import React, { useEffect, useRef } from 'react';
import { useSocket } from '@/hooks/useSocket';
import { useAppContext } from '@/context/AppContext';
import { apiService } from '@/services/api';
import ChatHeader from './ChatHeader';
import MessageList from './MessageList';
import ChatInput from './ChatInput';
import WelcomeMessage from './WelcomeMessage';
import { showToast } from '@/utils';

const ChatInterface: React.FC = () => {
  const { on, emit } = useSocket();
  const { chatState, addMessage, setTyping, loadMessages, clearMessages, setCurrentConversation } = useAppContext();
  const hasInitialized = useRef(false);
  const cleanupFunctionsRef = useRef<(() => void)[]>([]);
  const hasLoadedLatest = useRef(false);

  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    console.log('🔧 ChatInterface: Setting up socket event listeners...');
    
    // Clear any existing cleanup functions first
    cleanupFunctionsRef.current.forEach(cleanup => cleanup());
    cleanupFunctionsRef.current = [];

    // Set up socket event listeners
    const cleanupFunctions: (() => void)[] = [];

    // User message confirmation
    cleanupFunctions.push(
      on('user_message', (_data) => {
        console.log('Message sent successfully');
      })
    );

    // Bot response
    cleanupFunctions.push(
      on('bot_message', (data) => {
        console.log('Received bot_message:', data);
        addMessage({
          type: 'bot',
          message: data.message,
          timestamp: data.timestamp,
        });
        setTyping(false);
      })
    );

    // System messages
    cleanupFunctions.push(
      on('system_message', (data) => {
        addMessage({
          type: 'system',
          message: data.message,
          timestamp: data.timestamp,
        });
      })
    );

    // Conversation cleared
    cleanupFunctions.push(
      on('conversation_cleared', (_data) => {
        console.log('🧹 Received conversation_cleared event');
        console.log('📊 Current messages count before clear:', chatState.messages.length);
        clearMessages();
        // Clear the active conversation since we're starting fresh
        localStorage.removeItem('spanish-tutor-active-conversation');
        // Re-enable auto-loading for this session since we're starting fresh
        sessionStorage.removeItem('spanish-tutor-auto-load-disabled');
        // Notify backend to clear active conversation
        emit('set_active_conversation', { filename: null });
        // Reset the latest conversation loaded flag so a new conversation can be started
        hasLoadedLatest.current = false;
        console.log('✅ Messages cleared - showing welcome message');
        showToast('New conversation started', 'success');
      })
    );

    // Conversation loaded
    cleanupFunctions.push(
      on('conversation_loaded', (data) => {
        console.log('🔄 Received conversation_loaded:', data);
        console.log('📨 Current state messages count before clear:', chatState.messages.length);
        console.log('📨 Raw messages from server:', data.messages);
        
        const messages = data.messages
          .filter(msg => msg.message && msg.message.trim()) // Filter out empty messages
          .map((msg, index) => ({
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
        
        // Load new messages immediately (remove setTimeout delay)
        console.log('📥 Loading new messages...');
        loadMessages(messages);
        
        // Store the loaded conversation as the active one
        localStorage.setItem('spanish-tutor-active-conversation', data.filename);
        
        // Disable auto-loading for this session since we have a conversation loaded
        sessionStorage.setItem('spanish-tutor-auto-load-disabled', 'true');
        
        // Notify backend about the active conversation (it's already loaded via load_conversation event)
        // This is just to ensure consistency
        emit('set_active_conversation', { filename: data.filename });
        
        // Mark that we've loaded a conversation to prevent auto-loading latest
        hasLoadedLatest.current = true;
        
        console.log('📊 State should now have', messages.length, 'messages');
        showToast(`Loaded conversation with ${data.count} exchanges`, 'success');
      })
    );

    // Error handling
    cleanupFunctions.push(
      on('error', (data) => {
        console.error('Socket error:', data.message);
        showToast(data.message, 'error');
        setTyping(false);
      })
    );

    // Store cleanup functions in ref for later cleanup
    cleanupFunctionsRef.current = cleanupFunctions;

    // Cleanup function
    return () => {
      console.log('🧹 ChatInterface: Cleaning up socket event listeners...');
      cleanupFunctions.forEach(cleanup => cleanup());
    };
  }, [on, addMessage, setTyping, loadMessages, clearMessages]); // Include all dependencies now that they're stable

  // Load the appropriate conversation (either the active one or latest) if no messages are present
  useEffect(() => {
    const loadConversationOnMount = async () => {
      // Check if auto-loading has been disabled for this session
      let autoLoadDisabled = sessionStorage.getItem('spanish-tutor-auto-load-disabled') === 'true';
      
      // If auto-loading is disabled but we have no messages and no current conversation,
      // it means the page was refreshed and we lost the conversation state.
      // In this case, we should re-enable auto-loading.
      if (autoLoadDisabled && chatState.messages.length === 0 && !chatState.currentConversation) {
        console.log('🔄 Auto-load was disabled but no conversation state exists - re-enabling due to refresh');
        sessionStorage.removeItem('spanish-tutor-auto-load-disabled');
        autoLoadDisabled = false;
      }
      
      // Don't auto-load if:
      // 1. We've already loaded in this component instance
      // 2. Messages already exist (conversation is active)
      // 3. There's already a current conversation set (even if messages are 0 due to clearing)
      // 4. Auto-loading has been explicitly disabled for this session (and we still have state)
      if (hasLoadedLatest.current || chatState.messages.length > 0 || chatState.currentConversation || autoLoadDisabled) {
        console.log('🚫 Skipping auto-load:', {
          hasLoaded: hasLoadedLatest.current,
          messageCount: chatState.messages.length,
          currentConversation: chatState.currentConversation,
          autoLoadDisabled
        });
        return;
      }

      try {
        // Check if there's a specific conversation that was actively being viewed
        const activeConversationFilename = localStorage.getItem('spanish-tutor-active-conversation');
        
        if (activeConversationFilename) {
          console.log('🔄 Attempting to restore active conversation:', activeConversationFilename);
          
          try {
            const response = await apiService.getConversation(activeConversationFilename);
            
            if (response.data?.conversation) {
              console.log('📚 Found active conversation, loading...', response.data);
              
              const messages = response.data.conversation
                .flatMap((exchange: any, index: number) => [
                  {
                    id: `loaded-user-${index}`,
                    type: 'user' as const,
                    message: exchange.user,
                    timestamp: exchange.timestamp,
                  },
                  {
                    id: `loaded-bot-${index}`,
                    type: 'bot' as const,
                    message: exchange.bot,
                    timestamp: exchange.timestamp,
                  }
                ])
                .filter(msg => msg.message && msg.message.trim());

              if (messages.length > 0) {
                loadMessages(messages);
                setCurrentConversation(activeConversationFilename);
                // Notify backend about the active conversation
                emit('set_active_conversation', { filename: activeConversationFilename });
                // Disable auto-loading for this session since we have a conversation loaded
                sessionStorage.setItem('spanish-tutor-auto-load-disabled', 'true');
                console.log(`✅ Restored active conversation with ${messages.length} messages`);
                showToast(`Restored active conversation`, 'info');
                return; // Successfully loaded active conversation
              }
            }
          } catch (error) {
            console.warn('⚠️ Failed to load active conversation:', error);
            // Clear invalid active conversation from localStorage
            localStorage.removeItem('spanish-tutor-active-conversation');
          }
        }

        // If we get here, either:
        // 1. No active conversation was set in localStorage
        // 2. The active conversation file was not found or failed to load
        
        if (!activeConversationFilename) {
          // This is likely a first visit - no conversation has ever been loaded
          // Load the latest conversation to give the user something to see
          console.log('🆕 First visit detected - loading latest conversation');
          
          try {
            const response = await apiService.getLatestConversation();
            
            if (response.data?.exists && response.data.conversation) {
              console.log('📚 Found latest conversation for first visit, loading...', response.data);
              
              const messages = response.data.conversation
                .flatMap((exchange: any, index: number) => [
                  {
                    id: `loaded-user-${index}`,
                    type: 'user' as const,
                    message: exchange.user,
                    timestamp: exchange.timestamp,
                  },
                  {
                    id: `loaded-bot-${index}`,
                    type: 'bot' as const,
                    message: exchange.bot,
                    timestamp: exchange.timestamp,
                  }
                ])
                .filter(msg => msg.message && msg.message.trim());

              if (messages.length > 0) {
                loadMessages(messages);
                setCurrentConversation(response.data.filename);
                // Store this as the active conversation so it can be restored later
                localStorage.setItem('spanish-tutor-active-conversation', response.data.filename!);
                // Notify backend about the active conversation
                emit('set_active_conversation', { filename: response.data.filename! });
                // Disable auto-loading for this session since we have a conversation loaded
                sessionStorage.setItem('spanish-tutor-auto-load-disabled', 'true');
                console.log(`✅ Loaded latest conversation for first visit with ${messages.length} messages`);
                showToast(`Loaded recent conversation with ${response.data.exchanges} exchanges`, 'info');
                return;
              }
            }
          } catch (error) {
            console.error('⚠️ Failed to load latest conversation for first visit:', error);
          }
        }
        
        // If we get here, show welcome screen
        console.log('📝 No valid conversation found - showing welcome screen');
        console.log('🔍 Active conversation filename was:', activeConversationFilename);
        
      } catch (error) {
        console.error('⚠️ Failed to load conversation:', error);
        // Don't show error toast as this is not critical - user can start new conversation
      } finally {
        hasLoadedLatest.current = true;
      }
    };

    loadConversationOnMount();
  }, [chatState.messages.length, loadMessages, setCurrentConversation]);

  // Debug logging for chat state
  console.log('ChatInterface render - messages count:', chatState.messages.length);
  console.log('ChatInterface render - messages:', chatState.messages);

  return (
    <div className="chat-container">
      <ChatHeader />
      <div className="chat-messages" id="chat-messages">
        {chatState.messages.length === 0 ? (
          <WelcomeMessage />
        ) : (
          <MessageList messages={chatState.messages} isTyping={chatState.isTyping} />
        )}
      </div>
      <ChatInput />
    </div>
  );
};

export default ChatInterface;