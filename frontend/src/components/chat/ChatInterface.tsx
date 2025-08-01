import React, { useEffect, useRef } from 'react';
import { useSocket } from '@/hooks/useSocket';
import { useAppContext } from '@/context/AppContext';
import ChatHeader from './ChatHeader';
import MessageList from './MessageList';
import ChatInput from './ChatInput';
import WelcomeMessage from './WelcomeMessage';
import { showToast } from '@/utils';

const ChatInterface: React.FC = () => {
  const { on } = useSocket();
  const { chatState, addMessage, setTyping, loadMessages, clearMessages } = useAppContext();
  const hasInitialized = useRef(false);

  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;

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
      on('conversation_cleared', (data) => {
        console.log('🧹 Received conversation_cleared event');
        console.log('📊 Current messages count before clear:', chatState.messages.length);
        clearMessages();
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

    // Cleanup function
    return () => {
      cleanupFunctions.forEach(cleanup => cleanup());
    };
  }, [on, addMessage, setTyping, loadMessages, clearMessages]);

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