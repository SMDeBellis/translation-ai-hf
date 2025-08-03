import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import type { RegisterCredentials } from '@/types';

const RegisterPage: React.FC = () => {
  const { register, googleLogin, facebookLogin, authState } = useAuth();
  const navigate = useNavigate();
  
  const [credentials, setCredentials] = useState<RegisterCredentials>({
    email: '',
    password: '',
    display_name: '',
  });
  
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordErrors, setPasswordErrors] = useState<string[]>([]);

  const validatePassword = (password: string) => {
    const errors: string[] = [];
    
    if (password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    }
    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }
    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }
    if (!/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    }
    
    return errors;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate passwords match
    if (credentials.password !== confirmPassword) {
      setPasswordErrors(['Passwords do not match']);
      return;
    }
    
    // Validate password requirements
    const errors = validatePassword(credentials.password);
    if (errors.length > 0) {
      setPasswordErrors(errors);
      return;
    }
    
    try {
      await register(credentials);
      navigate('/');
    } catch (error) {
      // Error handling is done in the AuthProvider
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    
    if (name === 'confirmPassword') {
      setConfirmPassword(value);
    } else {
      setCredentials(prev => ({
        ...prev,
        [name]: value,
      }));
    }
    
    // Clear password errors when user starts typing
    if (name === 'password' || name === 'confirmPassword') {
      setPasswordErrors([]);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      // In a real app, you'd integrate with Google Sign-In SDK
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
          <h2>Create Account</h2>
          <p>Join us and start your Spanish learning adventure!</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="display_name">Display Name (Optional)</label>
            <input
              type="text"
              id="display_name"
              name="display_name"
              value={credentials.display_name}
              onChange={handleInputChange}
              placeholder="How should we call you?"
              disabled={authState.loading}
            />
          </div>

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
                placeholder="Create a strong password"
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

          <div className="form-group">
            <label htmlFor="confirmPassword">Confirm Password</label>
            <div className="password-input-group">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                id="confirmPassword"
                name="confirmPassword"
                value={confirmPassword}
                onChange={handleInputChange}
                required
                placeholder="Confirm your password"
                disabled={authState.loading}
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                disabled={authState.loading}
              >
                {showConfirmPassword ? '👁️' : '🙈'}
              </button>
            </div>
          </div>

          {passwordErrors.length > 0 && (
            <div className="password-errors">
              <ul>
                {passwordErrors.map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            </div>
          )}

          <button
            type="submit"
            className="auth-button primary"
            disabled={authState.loading}
          >
            {authState.loading ? 'Creating Account...' : 'Create Account'}
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
            Already have an account?{' '}
            <Link to="/login" className="auth-link">
              Sign in here
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;