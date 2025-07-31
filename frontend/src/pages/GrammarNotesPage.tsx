import React, { useState, useEffect } from 'react';
import { apiService } from '@/services/api';
import { GrammarNotesResponse } from '@/types';
import { showToast } from '@/utils';

const GrammarNotesPage: React.FC = () => {
  const [notes, setNotes] = useState<GrammarNotesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadGrammarNotes = async () => {
      try {
        setLoading(true);
        const response = await apiService.getGrammarNotes();
        
        if (response.error) {
          setError(response.error);
          showToast(response.error, 'error');
        } else if (response.data) {
          setNotes(response.data);
        }
      } catch (err) {
        console.error('Failed to load grammar notes:', err);
        setError('Failed to load grammar notes');
        showToast('Failed to load grammar notes', 'error');
      } finally {
        setLoading(false);
      }
    };

    loadGrammarNotes();
  }, []);

  const handleExport = async () => {
    try {
      await apiService.exportGrammarNotes();
      showToast('Grammar notes exported successfully', 'success');
    } catch (err) {
      console.error('Failed to export grammar notes:', err);
      showToast('Failed to export grammar notes', 'error');
    }
  };

  const handleRefresh = () => {
    setLoading(true);
    setError(null);
    // Reload the component
    window.location.reload();
  };

  if (loading) {
    return (
      <div className="grammar-notes-container">
        <div className="loading-state">
          <h2>Loading grammar notes...</h2>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="grammar-notes-container">
        <div className="error-state">
          <h2>Error loading grammar notes</h2>
          <p>{error}</p>
          <button className="btn btn-primary" onClick={handleRefresh}>
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="grammar-notes-container">
      <div className="grammar-notes-header">
        <div className="header-content">
          <h1>Grammar Notes</h1>
          <p>Your personalized Spanish grammar reference</p>
        </div>
        <div className="header-actions">
          <button
            className="btn btn-secondary"
            onClick={handleRefresh}
            title="Refresh notes"
          >
            🔄 Refresh
          </button>
          {notes?.exists && (
            <button
              className="btn btn-primary"
              onClick={handleExport}
              title="Export as Markdown"
            >
              📥 Export
            </button>
          )}
        </div>
      </div>

      <div className="grammar-notes-content">
        {!notes?.exists ? (
          <div className="empty-state">
            <div className="empty-icon">📝</div>
            <h3>No grammar notes yet</h3>
            <p>
              Grammar explanations and corrections from your conversations with the Spanish tutor 
              will automatically appear here.
            </p>
            <p>
              Start chatting and ask for grammar help to build your personalized reference!
            </p>
          </div>
        ) : notes.content.trim() === '' ? (
          <div className="empty-state">
            <div className="empty-icon">📝</div>
            <h3>Grammar notes file is empty</h3>
            <p>Your grammar notes file exists but doesn't contain any content yet.</p>
          </div>
        ) : (
          <div className="notes-viewer">
            <div className="notes-meta">
              <span className="file-size">
                File size: {notes.file_size ? `${Math.round(notes.file_size / 1024)}KB` : 'Unknown'}
              </span>
            </div>
            <div className="notes-content">
              <pre>{notes.content}</pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default GrammarNotesPage;