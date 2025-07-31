import React, { useState, useEffect } from 'react';
import { useSocket } from '@/hooks/useSocket';
import { apiService } from '@/services/api';
import { Conversation } from '@/types';
import { formatDetailedTimestamp, showToast } from '@/utils';

interface ConversationPickerProps {
  onClose: () => void;
}

const ConversationPicker: React.FC<ConversationPickerProps> = ({ onClose }) => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { emit } = useSocket();

  useEffect(() => {
    const loadConversations = async () => {
      try {
        setLoading(true);
        const response = await apiService.getConversations();
        
        if (response.error) {
          setError(response.error);
        } else if (response.data) {
          setConversations(response.data.conversations || []);
          if (response.data.conversations.length === 0) {
            showToast('No saved conversations found', 'info');
            onClose();
            return;
          }
        }
      } catch (err) {
        console.error('Failed to load conversations:', err);
        setError('Failed to load conversations');
        showToast('Failed to load conversations', 'error');
      } finally {
        setLoading(false);
      }
    };

    loadConversations();
  }, [onClose]);

  const handleLoadConversation = (filename: string) => {
    console.log('ConversationPicker - Loading conversation:', filename);
    emit('load_conversation', { filename });
    console.log('ConversationPicker - Emitted load_conversation event');
    onClose();
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="modal" style={{ display: 'flex' }} onClick={handleBackdropClick}>
      <div className="modal-content">
        <div className="modal-header">
          <h3>Load Conversation</h3>
          <button className="modal-close" onClick={onClose}>
            &times;
          </button>
        </div>
        <div className="modal-body">
          {loading ? (
            <div className="loading-state">
              <p>Loading conversations...</p>
            </div>
          ) : error ? (
            <div className="error-state">
              <p>Error: {error}</p>
            </div>
          ) : conversations.length === 0 ? (
            <div className="empty-state">
              <p>No saved conversations found.</p>
            </div>
          ) : (
            <div className="conversation-list">
              {conversations.map((conv, index) => (
                <div key={index} className="conversation-item">
                  <div className="conversation-info">
                    <div className="conversation-date">
                      {formatDetailedTimestamp(conv.session_start)}
                    </div>
                    <div className="conversation-details">
                      {conv.exchanges} exchanges • {conv.model} • {Math.round(conv.file_size / 1024)}KB
                    </div>
                  </div>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => handleLoadConversation(conv.file.split('/').pop() || '')}
                  >
                    Load
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ConversationPicker;