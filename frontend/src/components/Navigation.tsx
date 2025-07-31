import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import ConnectionStatus from './ConnectionStatus';

const Navigation: React.FC = () => {
  const location = useLocation();

  const isActive = (path: string) => {
    return location.pathname === path;
  };

  return (
    <nav className="navbar">
      <div className="nav-container">
        <div className="nav-brand">
          <span className="nav-icon">🎓</span>
          <span className="nav-title">Spanish Tutor</span>
        </div>
        <div className="nav-menu">
          <Link 
            to="/" 
            className={`nav-link ${isActive('/') ? 'active' : ''}`}
          >
            <span className="nav-link-icon">💬</span>
            Chat
          </Link>
          <Link 
            to="/grammar-notes" 
            className={`nav-link ${isActive('/grammar-notes') ? 'active' : ''}`}
          >
            <span className="nav-link-icon">📝</span>
            Grammar Notes
          </Link>
          <Link 
            to="/settings" 
            className={`nav-link ${isActive('/settings') ? 'active' : ''}`}
          >
            <span className="nav-link-icon">⚙️</span>
            Settings
          </Link>
        </div>
        <div className="nav-status">
          <ConnectionStatus />
        </div>
      </div>
    </nav>
  );
};

export default Navigation;