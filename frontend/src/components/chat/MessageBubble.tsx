import React from 'react';
import { Message } from '@/types';
import { formatTimestamp } from '@/utils';

interface MessageBubbleProps {
  message: Message;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ message }) => {
  const getAvatar = () => {
    switch (message.type) {
      case 'user':
        return '👤';
      case 'bot':
        return '🎓';
      case 'system':
        return 'ℹ️';
      default:
        return '💬';
    }
  };

  return (
    <div className={`message ${message.type}`}>
      <div className="message-avatar">
        {getAvatar()}
      </div>
      <div className="message-content">
        <div className="message-text">
          {message.message}
        </div>
        <small className="message-timestamp">
          {formatTimestamp(message.timestamp)}
        </small>
      </div>
    </div>
  );
};

export default MessageBubble;