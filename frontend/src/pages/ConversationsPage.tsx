import React, { useState, useEffect } from 'react';
import { apiService } from '@/services/api';
import { Conversation } from '@/types';
import { formatDetailedTimestamp, showToast } from '@/utils';

const ConversationsPage: React.FC = () => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadConversations = async () => {
      try {
        setLoading(true);
        const response = await apiService.getConversations();
        
        if (response.error) {
          setError(response.error);
          showToast(response.error, 'error');
        } else if (response.data) {
          setConversations(response.data.conversations || []);
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
  }, []);

  const handleDeleteConversation = async (_filename: string) => {
    const confirmed = window.confirm('Are you sure you want to delete this conversation?');
    if (!confirmed) return;

    try {
      // Note: Delete functionality would need to be implemented in the backend
      showToast('Delete functionality not yet implemented', 'info');
    } catch (err) {
      console.error('Failed to delete conversation:', err);
      showToast('Failed to delete conversation', 'error');
    }
  };

  if (loading) {
    return (
      <div className="conversations-container">
        <div className="loading-state">
          <h2>Loading conversations...</h2>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="conversations-container">
        <div className="error-state">
          <h2>Error loading conversations</h2>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="conversations-container">
      <div className="conversations-header">
        <h1>Conversation History</h1>
        <p>Manage your saved Spanish tutoring conversations</p>
      </div>

      {conversations.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📚</div>
          <h3>No conversations yet</h3>
          <p>Start chatting with the Spanish tutor to create your first conversation!</p>
        </div>
      ) : (
        <div className="conversations-grid">
          {conversations.map((conv, index) => (
            <div key={index} className="conversation-card">
              <div className="conversation-card-header">
                <div className="conversation-date">
                  {formatDetailedTimestamp(conv.session_start)}
                </div>
                <div className="conversation-actions">
                  <button
                    className="btn btn-sm btn-danger"
                    onClick={() => handleDeleteConversation(conv.file)}
                    title="Delete conversation"
                  >
                    🗑️
                  </button>
                </div>
              </div>
              <div className="conversation-card-body">
                <div className="conversation-stats">
                  <span className="stat">
                    <strong>{conv.exchanges}</strong> exchanges
                  </span>
                  <span className="stat">
                    <strong>{conv.model}</strong> model
                  </span>
                  <span className="stat">
                    <strong>{Math.round(conv.file_size / 1024)}KB</strong> size
                  </span>
                </div>
              </div>
              <div className="conversation-card-footer">
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => {
                    // Navigate to chat page and load conversation
                    window.location.href = '/';
                    // Note: This would need proper routing integration
                  }}
                >
                  Continue Chat
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ConversationsPage;