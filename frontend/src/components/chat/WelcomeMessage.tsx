import React from 'react';

const WelcomeMessage: React.FC = () => {
  return (
    <div className="welcome-message">
      <div className="welcome-icon">🎓</div>
      <h3>¡Hola! Welcome to Spanish Tutor</h3>
      <p>I'm here to help you learn Spanish through conversation. You can:</p>
      <ul>
        <li>Ask me to translate words or phrases</li>
        <li>Practice conversations in Spanish</li>
        <li>Request grammar explanations</li>
        <li>Get corrections and feedback</li>
      </ul>
      <p>Type a message below to get started!</p>
    </div>
  );
};

export default WelcomeMessage;