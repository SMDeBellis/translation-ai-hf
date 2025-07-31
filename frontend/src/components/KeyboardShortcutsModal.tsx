import React, { useState, useEffect } from 'react';

const KeyboardShortcutsModal: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl + / - Show keyboard shortcuts
      if (e.ctrlKey && e.key === '/') {
        e.preventDefault();
        setIsOpen(true);
      }
      // Escape to close
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      setIsOpen(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal" style={{ display: 'flex' }} onClick={handleBackdropClick}>
      <div className="modal-content">
        <div className="modal-header">
          <h3>Keyboard Shortcuts</h3>
          <button className="modal-close" onClick={() => setIsOpen(false)}>
            &times;
          </button>
        </div>
        <div className="modal-body">
          <div className="shortcuts-grid">
            <div className="shortcut-item">
              <div className="shortcut-keys">
                <kbd>Ctrl</kbd> + <kbd>Enter</kbd>
              </div>
              <span>Send message</span>
            </div>
            <div className="shortcut-item">
              <div className="shortcut-keys">
                <kbd>Ctrl</kbd> + <kbd>N</kbd>
              </div>
              <span>New conversation</span>
            </div>
            <div className="shortcut-item">
              <div className="shortcut-keys">
                <kbd>Ctrl</kbd> + <kbd>L</kbd>
              </div>
              <span>Clear input</span>
            </div>
            <div className="shortcut-item">
              <div className="shortcut-keys">
                <kbd>Escape</kbd>
              </div>
              <span>Focus input</span>
            </div>
            <div className="shortcut-item">
              <div className="shortcut-keys">
                <kbd>Ctrl</kbd> + <kbd>/</kbd>
              </div>
              <span>Show shortcuts</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default KeyboardShortcutsModal;