#!/usr/bin/env python3
"""
Authentication Module for Spanish Tutor
Handles user registration, login, OAuth, and session management
"""

import os
import re
import secrets
from datetime import datetime, timedelta
from functools import wraps

from flask import Blueprint, request, jsonify, session, redirect, url_for, current_app
from flask_login import login_user, logout_user, login_required, current_user
from werkzeug.security import generate_password_hash
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token
import requests

from web_gui.models import db, User, UserSession, create_default_preferences

# Create authentication blueprint
auth_bp = Blueprint('auth', __name__, url_prefix='/auth')

# Email validation regex
EMAIL_REGEX = re.compile(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$')

# Password requirements
MIN_PASSWORD_LENGTH = 8


def validate_email(email):
    """Validate email format."""
    return EMAIL_REGEX.match(email) is not None


def validate_password(password):
    """Validate password requirements."""
    if len(password) < MIN_PASSWORD_LENGTH:
        return False, f"Password must be at least {MIN_PASSWORD_LENGTH} characters long"
    
    if not re.search(r'[A-Z]', password):
        return False, "Password must contain at least one uppercase letter"
    
    if not re.search(r'[a-z]', password):
        return False, "Password must contain at least one lowercase letter"
    
    if not re.search(r'\d', password):
        return False, "Password must contain at least one number"
    
    return True, "Password is valid"


def create_user_session(user, ip_address=None, user_agent=None):
    """Create a new user session record."""
    # Always generate a new unique session ID to avoid conflicts
    session_id = secrets.token_urlsafe(32)
    
    # Deactivate any existing sessions for this user to prevent accumulation
    existing_sessions = UserSession.query.filter_by(user_id=user.id, is_active=True).all()
    for existing_session in existing_sessions:
        existing_session.is_active = False
    
    expires_at = datetime.utcnow() + timedelta(hours=24)
    
    user_session = UserSession(
        session_id=session_id,
        user_id=user.id,
        ip_address=ip_address,
        user_agent=user_agent,
        expires_at=expires_at
    )
    
    db.session.add(user_session)
    db.session.commit()
    
    session['session_id'] = session_id
    return user_session


@auth_bp.route('/register', methods=['POST'])
def register():
    """Register a new user with email and password."""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        email = data.get('email', '').strip().lower()
        password = data.get('password', '')
        display_name = data.get('display_name', '').strip()
        
        # Validate input
        if not email or not password:
            return jsonify({'error': 'Email and password are required'}), 400
        
        if not validate_email(email):
            return jsonify({'error': 'Invalid email format'}), 400
        
        is_valid, password_error = validate_password(password)
        if not is_valid:
            return jsonify({'error': password_error}), 400
        
        # Check if user already exists
        existing_user = User.query.filter_by(email=email).first()
        if existing_user:
            return jsonify({'error': 'User with this email already exists'}), 409
        
        # Create new user
        user = User(
            email=email,
            display_name=display_name or email.split('@')[0],
            provider='email'
        )
        user.set_password(password)
        
        db.session.add(user)
        db.session.commit()
        
        # Create user directory structure
        user_paths = user.get_data_paths()
        os.makedirs(user_paths['conversations_dir'], exist_ok=True)
        os.makedirs(os.path.dirname(user_paths['grammar_notes_file']), exist_ok=True)
        
        # Create default preferences
        create_default_preferences(user.id)
        
        # Log the user in
        login_user(user, remember=True)
        
        # Create session record
        create_user_session(
            user,
            ip_address=request.environ.get('REMOTE_ADDR'),
            user_agent=request.headers.get('User-Agent')
        )
        
        current_app.logger.info(f"New user registered: {email}")
        
        return jsonify({
            'message': 'Registration successful',
            'user': user.to_dict()
        }), 201
        
    except Exception as e:
        current_app.logger.error(f"Registration error: {str(e)}")
        db.session.rollback()
        return jsonify({'error': 'Registration failed'}), 500


@auth_bp.route('/login', methods=['POST'])
def login():
    """Login with email and password."""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        email = data.get('email', '').strip().lower()
        password = data.get('password', '')
        remember_me = data.get('remember_me', False)
        
        if not email or not password:
            return jsonify({'error': 'Email and password are required'}), 400
        
        # Find user
        user = User.query.filter_by(email=email, is_active=True).first()
        
        if not user or not user.check_password(password):
            return jsonify({'error': 'Invalid email or password'}), 401
        
        # Log the user in
        login_user(user, remember=remember_me)
        
        # Create session record
        create_user_session(
            user,
            ip_address=request.environ.get('REMOTE_ADDR'),
            user_agent=request.headers.get('User-Agent')
        )
        
        current_app.logger.info(f"User logged in: {email}")
        
        return jsonify({
            'message': 'Login successful',
            'user': user.to_dict()
        }), 200
        
    except Exception as e:
        current_app.logger.error(f"Login error: {str(e)}")
        return jsonify({'error': 'Login failed'}), 500


@auth_bp.route('/logout', methods=['POST'])
@login_required
def logout():
    """Logout the current user."""
    try:
        user_id = current_user.id
        session_id = session.get('session_id')
        
        # Deactivate session record
        if session_id:
            user_session = UserSession.query.filter_by(session_id=session_id).first()
            if user_session:
                user_session.is_active = False
                db.session.commit()
        
        # Logout user
        logout_user()
        session.clear()
        
        current_app.logger.info(f"User logged out: {user_id}")
        
        return jsonify({'message': 'Logout successful'}), 200
        
    except Exception as e:
        current_app.logger.error(f"Logout error: {str(e)}")
        return jsonify({'error': 'Logout failed'}), 500


@auth_bp.route('/google', methods=['POST'])
def google_auth():
    """Handle Google OAuth authentication."""
    try:
        data = request.get_json()
        id_token_str = data.get('id_token')
        
        if not id_token_str:
            return jsonify({'error': 'Google ID token is required'}), 400
        
        # Verify the Google ID token
        google_client_id = current_app.config.get('GOOGLE_CLIENT_ID')
        if not google_client_id:
            return jsonify({'error': 'Google OAuth not configured'}), 500
        
        try:
            id_info = id_token.verify_oauth2_token(
                id_token_str, google_requests.Request(), google_client_id
            )
            
            if id_info['iss'] not in ['accounts.google.com', 'https://accounts.google.com']:
                raise ValueError('Wrong issuer.')
            
        except ValueError:
            return jsonify({'error': 'Invalid Google ID token'}), 401
        
        # Extract user info
        email = id_info.get('email', '').lower()
        display_name = id_info.get('name', '')
        profile_picture = id_info.get('picture', '')
        google_id = id_info.get('sub')
        
        if not email:
            return jsonify({'error': 'Email not provided by Google'}), 400
        
        # Find or create user
        user = User.query.filter_by(email=email).first()
        
        if user:
            # Update existing user with Google info if needed
            if user.provider != 'google':
                user.provider = 'google'
                user.provider_id = google_id
            user.profile_picture_url = profile_picture
            if display_name and not user.display_name:
                user.display_name = display_name
            user.updated_at = datetime.utcnow()
        else:
            # Create new user
            user = User(
                email=email,
                display_name=display_name or email.split('@')[0],
                provider='google',
                provider_id=google_id,
                profile_picture_url=profile_picture
            )
            db.session.add(user)
            db.session.commit()
            
            # Create user directory structure
            user_paths = user.get_data_paths()
            os.makedirs(user_paths['conversations_dir'], exist_ok=True)
            os.makedirs(os.path.dirname(user_paths['grammar_notes_file']), exist_ok=True)
            
            # Create default preferences
            create_default_preferences(user.id)
        
        db.session.commit()
        
        # Log the user in
        login_user(user, remember=True)
        
        # Create session record
        create_user_session(
            user,
            ip_address=request.environ.get('REMOTE_ADDR'),
            user_agent=request.headers.get('User-Agent')
        )
        
        current_app.logger.info(f"Google OAuth login: {email}")
        
        return jsonify({
            'message': 'Google authentication successful',
            'user': user.to_dict()
        }), 200
        
    except Exception as e:
        current_app.logger.error(f"Google OAuth error: {str(e)}")
        db.session.rollback()
        return jsonify({'error': 'Google authentication failed'}), 500


@auth_bp.route('/facebook', methods=['POST'])
def facebook_auth():
    """Handle Facebook OAuth authentication."""
    try:
        data = request.get_json()
        access_token = data.get('access_token')
        
        if not access_token:
            return jsonify({'error': 'Facebook access token is required'}), 400
        
        # Verify Facebook access token and get user info
        fb_app_id = current_app.config.get('FACEBOOK_APP_ID')
        fb_app_secret = current_app.config.get('FACEBOOK_APP_SECRET')
        
        if not fb_app_id or not fb_app_secret:
            return jsonify({'error': 'Facebook OAuth not configured'}), 500
        
        # Verify token with Facebook
        verify_url = f"https://graph.facebook.com/debug_token?input_token={access_token}&access_token={fb_app_id}|{fb_app_secret}"
        verify_response = requests.get(verify_url)
        
        if verify_response.status_code != 200:
            return jsonify({'error': 'Facebook token verification failed'}), 401
        
        verify_data = verify_response.json()
        if not verify_data.get('data', {}).get('is_valid'):
            return jsonify({'error': 'Invalid Facebook access token'}), 401
        
        # Get user info from Facebook
        user_url = f"https://graph.facebook.com/me?fields=id,name,email,picture&access_token={access_token}"
        user_response = requests.get(user_url)
        
        if user_response.status_code != 200:
            return jsonify({'error': 'Failed to get Facebook user info'}), 400
        
        fb_user_data = user_response.json()
        
        # Extract user info
        email = fb_user_data.get('email', '').lower()
        display_name = fb_user_data.get('name', '')
        profile_picture = fb_user_data.get('picture', {}).get('data', {}).get('url', '')
        facebook_id = fb_user_data.get('id')
        
        if not email:
            return jsonify({'error': 'Email not provided by Facebook'}), 400
        
        # Find or create user
        user = User.query.filter_by(email=email).first()
        
        if user:
            # Update existing user with Facebook info if needed
            if user.provider != 'facebook':
                user.provider = 'facebook'
                user.provider_id = facebook_id
            user.profile_picture_url = profile_picture
            if display_name and not user.display_name:
                user.display_name = display_name
            user.updated_at = datetime.utcnow()
        else:
            # Create new user
            user = User(
                email=email,
                display_name=display_name or email.split('@')[0],
                provider='facebook',
                provider_id=facebook_id,
                profile_picture_url=profile_picture
            )
            db.session.add(user)
            db.session.commit()
            
            # Create user directory structure
            user_paths = user.get_data_paths()
            os.makedirs(user_paths['conversations_dir'], exist_ok=True)
            os.makedirs(os.path.dirname(user_paths['grammar_notes_file']), exist_ok=True)
            
            # Create default preferences
            create_default_preferences(user.id)
        
        db.session.commit()
        
        # Log the user in
        login_user(user, remember=True)
        
        # Create session record
        create_user_session(
            user,
            ip_address=request.environ.get('REMOTE_ADDR'),
            user_agent=request.headers.get('User-Agent')
        )
        
        current_app.logger.info(f"Facebook OAuth login: {email}")
        
        return jsonify({
            'message': 'Facebook authentication successful',
            'user': user.to_dict()
        }), 200
        
    except Exception as e:
        current_app.logger.error(f"Facebook OAuth error: {str(e)}")
        db.session.rollback()
        return jsonify({'error': 'Facebook authentication failed'}), 500


@auth_bp.route('/status', methods=['GET'])
def auth_status():
    """Get current authentication status."""
    try:
        if current_user.is_authenticated:
            return jsonify({
                'authenticated': True,
                'user': current_user.to_dict()
            }), 200
        else:
            return jsonify({
                'authenticated': False,
                'user': None
            }), 200
            
    except Exception as e:
        current_app.logger.error(f"Auth status error: {str(e)}")
        return jsonify({'error': 'Failed to get auth status'}), 500


@auth_bp.route('/change-password', methods=['POST'])
@login_required
def change_password():
    """Change user password (for email/password users only)."""
    try:
        if current_user.provider != 'email':
            return jsonify({'error': 'Password change not available for OAuth users'}), 400
        
        data = request.get_json()
        current_password = data.get('current_password', '')
        new_password = data.get('new_password', '')
        
        if not current_password or not new_password:
            return jsonify({'error': 'Current and new passwords are required'}), 400
        
        # Verify current password
        if not current_user.check_password(current_password):
            return jsonify({'error': 'Current password is incorrect'}), 401
        
        # Validate new password
        is_valid, password_error = validate_password(new_password)
        if not is_valid:
            return jsonify({'error': password_error}), 400
        
        # Update password
        current_user.set_password(new_password)
        current_user.updated_at = datetime.utcnow()
        db.session.commit()
        
        current_app.logger.info(f"Password changed for user: {current_user.email}")
        
        return jsonify({'message': 'Password changed successfully'}), 200
        
    except Exception as e:
        current_app.logger.error(f"Change password error: {str(e)}")
        db.session.rollback()
        return jsonify({'error': 'Failed to change password'}), 500


def require_auth_api(f):
    """Decorator to require authentication for API endpoints."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not current_user.is_authenticated:
            return jsonify({'error': 'Authentication required'}), 401
        return f(*args, **kwargs)
    return decorated_function