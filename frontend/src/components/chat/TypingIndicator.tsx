import React from 'react';

const TypingIndicator: React.FC = () => {
  return (
    <div className="message bot typing-indicator">
      <div className="message-avatar">🎓</div>
      <div className="message-content">
        <div className="typing-dots">
          <span></span>
          <span></span>
          <span></span>
        </div>
      </div>
    </div>
  );
};

export default TypingIndicator;