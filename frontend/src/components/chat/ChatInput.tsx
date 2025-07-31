import React, { useState, useRef, useEffect } from 'react';
import { useSocket } from '@/hooks/useSocket';
import { useAppContext } from '@/context/AppContext';

const ChatInput: React.FC = () => {
  const [message, setMessage] = useState('');
  const { emit } = useSocket();
  const { chatState, addMessage, setTyping } = useAppContext();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const adjustTextareaHeight = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      const scrollHeight = textarea.scrollHeight;
      const maxHeight = 120; // max-height from CSS
      textarea.style.height = Math.min(scrollHeight, maxHeight) + 'px';
    }
  };


  const clearInput = () => {
    setMessage('');
    adjustTextareaHeight();
    textareaRef.current?.focus();
  };

  const sendMessage = () => {
    const trimmedMessage = message.trim();
    
    if (!trimmedMessage || !chatState.isConnected || chatState.isTyping) {
      return;
    }

    // Add user message to UI immediately
    addMessage({
      type: 'user',
      message: trimmedMessage,
      timestamp: new Date().toISOString(),
    });
    
    // Clear input
    clearInput();
    
    // Show typing indicator
    setTyping(true);
    
    // Send to server
    console.log('Sending message:', trimmedMessage);
    emit('send_message', { message: trimmedMessage });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Ctrl+Enter or Cmd+Enter to send
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      sendMessage();
    }
    
    // Ctrl+L to clear input
    if ((e.ctrlKey || e.metaKey) && e.key === 'l') {
      e.preventDefault();
      clearInput();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value);
    adjustTextareaHeight();
  };

  useEffect(() => {
    adjustTextareaHeight();
  }, [message]);

  // Global keyboard shortcuts
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Escape to focus input
      if (e.key === 'Escape') {
        textareaRef.current?.focus();
      }
    };

    document.addEventListener('keydown', handleGlobalKeyDown);
    return () => document.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  // Focus input after a short delay
  useEffect(() => {
    const timer = setTimeout(() => {
      textareaRef.current?.focus();
    }, 500);

    return () => clearTimeout(timer);
  }, []);

  const isDisabled = !message.trim() || !chatState.isConnected || chatState.isTyping;

  return (
    <div className="chat-input-container">
      <div className="chat-input-wrapper">
        <textarea
          ref={textareaRef}
          className="chat-input"
          placeholder="Type your message here... (Ctrl+Enter to send)"
          rows={1}
          value={message}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
        />
        <button
          className="send-button"
          disabled={isDisabled}
          onClick={sendMessage}
          title="Send Message (Ctrl+Enter)"
        >
          <span className="send-icon">📤</span>
        </button>
      </div>
      <div className="input-help">
        <span className="help-text">
          Press <kbd>Ctrl</kbd> + <kbd>Enter</kbd> to send, <kbd>Ctrl</kbd> + <kbd>L</kbd> to clear
        </span>
      </div>
    </div>
  );
};

export default ChatInput;