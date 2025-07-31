import React from 'react';

const Footer: React.FC = () => {

  return (
    <footer className="footer">
      <div className="footer-content">
        <p>&copy; 2024 Spanish Tutor - AI Language Learning Assistant</p>
        <div className="footer-links">
          <button 
            className="footer-link-btn"
            onClick={() => {
              // Trigger keyboard shortcuts modal
              const event = new KeyboardEvent('keydown', { key: '/', ctrlKey: true });
              document.dispatchEvent(event);
            }}
          >
            Keyboard Shortcuts
          </button>
          <button 
            className="footer-link-btn"
            onClick={() => {
              // Trigger about modal
              window.dispatchEvent(new CustomEvent('showAbout'));
            }}
          >
            About
          </button>
        </div>
      </div>
    </footer>
  );
};

export default Footer;