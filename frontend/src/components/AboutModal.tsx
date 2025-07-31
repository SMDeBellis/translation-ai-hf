import React, { useState } from 'react';

const AboutModal: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      setIsOpen(false);
    }
  };

  // This will be triggered by the Footer component
  React.useEffect(() => {
    const handleShowAbout = () => setIsOpen(true);
    window.addEventListener('showAbout', handleShowAbout);
    return () => window.removeEventListener('showAbout', handleShowAbout);
  }, []);

  if (!isOpen) return null;

  return (
    <div className="modal" style={{ display: 'flex' }} onClick={handleBackdropClick}>
      <div className="modal-content">
        <div className="modal-header">
          <h3>About Spanish Tutor</h3>
          <button className="modal-close" onClick={() => setIsOpen(false)}>
            &times;
          </button>
        </div>
        <div className="modal-body">
          <h4>AI Language Learning Assistant</h4>
          <p>A conversational Spanish/English tutoring application powered by Ollama and built with modern web technologies.</p>
          
          <h5>Features:</h5>
          <ul>
            <li>Real-time chat interface with AI tutor</li>
            <li>Automatic conversation saving and management</li>
            <li>Grammar notes collection and export</li>
            <li>Responsive design for all devices</li>
            <li>Cross-platform web accessibility</li>
          </ul>
          
          <p><strong>Version:</strong> 3.0 (React Edition)</p>
        </div>
      </div>
    </div>
  );
};

export default AboutModal;