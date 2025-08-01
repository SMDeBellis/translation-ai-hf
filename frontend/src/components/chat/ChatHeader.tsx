import React, { useState } from 'react';
import { useSocket } from '@/hooks/useSocket';
import ConversationPicker from './ConversationPicker';

const ChatHeader: React.FC = () => {
  const { emit } = useSocket();
  const [showConversationPicker, setShowConversationPicker] = useState(false);

  const handleNewConversation = () => {
    const confirmed = window.confirm(
      'Start a new conversation? Current conversation will be saved automatically.'
    );
    
    if (confirmed) {
      console.log('🔄 User confirmed new conversation - emitting new_conversation event');
      emit('new_conversation', undefined);
      console.log('✅ new_conversation event emitted');
    }
  };

  const handleLoadConversation = () => {
    setShowConversationPicker(true);
  };

  const handleKeyboardShortcut = (e: KeyboardEvent) => {
    // Ctrl+N for new conversation
    if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
      e.preventDefault();
      handleNewConversation();
    }
  };

  React.useEffect(() => {
    document.addEventListener('keydown', handleKeyboardShortcut);
    return () => document.removeEventListener('keydown', handleKeyboardShortcut);
  }, []);

  return (
    <>
      <div className="chat-header">
        <div className="chat-title">
          <h2>Spanish Language Tutor</h2>
          <p>Practice Spanish conversation and get instant feedback</p>
        </div>
        <div className="chat-actions">
          <button 
            className="btn btn-secondary" 
            onClick={handleNewConversation}
            title="Start New Conversation (Ctrl+N)"
          >
            <span className="btn-icon">➕</span>
            New Chat
          </button>
          <button 
            className="btn btn-secondary" 
            onClick={handleLoadConversation}
            title="Load Conversation"
          >
            <span className="btn-icon">📁</span>
            Load
          </button>
        </div>
      </div>

      {showConversationPicker && (
        <ConversationPicker onClose={() => setShowConversationPicker(false)} />
      )}
    </>
  );
};

export default ChatHeader;