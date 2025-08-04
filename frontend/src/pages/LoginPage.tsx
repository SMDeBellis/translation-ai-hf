import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import type { LoginCredentials } from '@/types';

const LoginPage: React.FC = () => {
  const { login, googleLogin, facebookLogin, authState } = useAuth();
  const navigate = useNavigate();
  
  const [credentials, setCredentials] = useState<LoginCredentials>({
    email: '',
    password: '',
    remember_me: false,
  });
  
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await login(credentials);
      navigate('/');
    } catch (error) {
      // Error handling is done in the AuthProvider
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setCredentials(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleGoogleLogin = async () => {
    try {
      // In a real app, you'd integrate with Google Sign-In SDK
      // For now, this is a placeholder
      console.log('Google login clicked - integrate with Google SDK');
      // await googleLogin(idToken);
      // navigate('/');
    } catch (error) {
      // Error handling is done in the AuthProvider
    }
  };

  const handleFacebookLogin = async () => {
    try {
      // In a real app, you'd integrate with Facebook SDK
      // For now, this is a placeholder
      console.log('Facebook login clicked - integrate with Facebook SDK');
      // await facebookLogin(accessToken);
      // navigate('/');
    } catch (error) {
      // Error handling is done in the AuthProvider
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <h1>🎓 Spanish Tutor</h1>
          <h2>Sign In</h2>
          <p>Welcome back! Sign in to continue your Spanish learning journey.</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="email">Email Address</label>
            <input
              type="email"
              id="email"
              name="email"
              value={credentials.email}
              onChange={handleInputChange}
              required
              placeholder="Enter your email"
              disabled={authState.loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <div className="password-input-group">
              <input
                type={showPassword ? 'text' : 'password'}
                id="password"
                name="password"
                value={credentials.password}
                onChange={handleInputChange}
                required
                placeholder="Enter your password"
                disabled={authState.loading}
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword(!showPassword)}
                disabled={authState.loading}
              >
                {showPassword ? '👁️' : '🙈'}
              </button>
            </div>
          </div>

          <div className="form-group checkbox-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                name="remember_me"
                checked={credentials.remember_me}
                onChange={handleInputChange}
                disabled={authState.loading}
              />
              <span className="checkbox-text">Remember me</span>
            </label>
          </div>

          <button
            type="submit"
            className="auth-button primary"
            disabled={authState.loading}
          >
            {authState.loading ? 'Signing In...' : 'Sign In'}
          </button>
        </form>

        <div className="auth-divider">
          <span>or</span>
        </div>

        <div className="social-login">
          <button
            type="button"
            className="auth-button google"
            onClick={handleGoogleLogin}
            disabled={authState.loading}
          >
            <span className="social-icon">🔍</span>
            Continue with Google
          </button>

          <button
            type="button"
            className="auth-button facebook"
            onClick={handleFacebookLogin}
            disabled={authState.loading}
          >
            <span className="social-icon">📘</span>
            Continue with Facebook
          </button>
        </div>

        <div className="auth-footer">
          <p>
            Don't have an account?{' '}
            <Link to="/register" className="auth-link">
              Sign up here
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;