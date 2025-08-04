import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import ConnectionStatus from './ConnectionStatus';

const Navigation: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { authState, logout } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const isActive = (path: string) => {
    return location.pathname === path;
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  // Close user menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

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
          {authState.user && (
            <div className="user-menu" ref={menuRef}>
              <button
                className="user-button"
                onClick={() => setShowUserMenu(!showUserMenu)}
              >
                <span className="user-avatar">
                  {authState.user.profile_picture_url ? (
                    <img 
                      src={authState.user.profile_picture_url} 
                      alt={authState.user.display_name}
                      className="user-avatar-img"
                    />
                  ) : (
                    <span className="user-avatar-text">
                      {authState.user.display_name?.charAt(0).toUpperCase() || '?'}
                    </span>
                  )}
                </span>
                <span className="user-name">{authState.user.display_name}</span>
                <span className="user-menu-arrow">{showUserMenu ? '▲' : '▼'}</span>
              </button>
              {showUserMenu && (
                <div className="user-dropdown">
                  <div className="user-dropdown-header">
                    <div className="user-dropdown-name">{authState.user.display_name}</div>
                    <div className="user-dropdown-email">{authState.user.email}</div>
                  </div>
                  <div className="user-dropdown-divider"></div>
                  <button 
                    className="user-dropdown-item logout-button"
                    onClick={handleLogout}
                  >
                    <span className="logout-icon">🚪</span>
                    Logout
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navigation;