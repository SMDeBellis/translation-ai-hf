import React from 'react';
import { useAppContext } from '@/context/AppContext';
import ChatHeader from './ChatHeader';
import MessageList from './MessageList';
import ChatInput from './ChatInput';
import WelcomeMessage from './WelcomeMessage';

const ChatInterface: React.FC = () => {
  const { chatState } = useAppContext();

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