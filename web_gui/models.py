#!/usr/bin/env python3
"""
Database Models for Spanish Tutor Authentication System
"""

import os
import hashlib
from datetime import datetime, timedelta
from flask_sqlalchemy import SQLAlchemy
from flask_login import UserMixin
from werkzeug.security import generate_password_hash, check_password_hash

db = SQLAlchemy()

class User(UserMixin, db.Model):
    """User model for authentication and profile management."""
    
    __tablename__ = 'users'
    
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(255), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=True)  # Nullable for OAuth users
    provider = db.Column(db.String(50), nullable=False, default='email')  # email, google, facebook
    provider_id = db.Column(db.String(255), nullable=True)  # OAuth provider user ID
    display_name = db.Column(db.String(255), nullable=True)
    profile_picture_url = db.Column(db.String(500), nullable=True)
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    # Relationships
    sessions = db.relationship('UserSession', backref='user', lazy=True, cascade='all, delete-orphan')
    preferences = db.relationship('UserPreference', backref='user', lazy=True, cascade='all, delete-orphan')
    
    def __repr__(self):
        return f'<User {self.email}>'
    
    def set_password(self, password):
        """Set password hash for email/password authentication."""
        self.password_hash = generate_password_hash(password)
    
    def check_password(self, password):
        """Check password for email/password authentication."""
        if not self.password_hash:
            return False
        return check_password_hash(self.password_hash, password)
    
    def get_user_directory_id(self):
        """Generate a consistent directory ID for file storage."""
        # Use email hash for consistent directory naming
        return f"user_{hashlib.sha256(self.email.encode()).hexdigest()[:12]}"
    
    def get_data_paths(self):
        """Get user-specific file paths for conversations and grammar notes."""
        user_dir_id = self.get_user_directory_id()
        base_dir = os.path.join('web_gui', 'users', user_dir_id)
        
        return {
            'user_id': user_dir_id,
            'user_dir': base_dir,
            'conversations_dir': os.path.join(base_dir, 'conversations'),
            'grammar_notes_file': os.path.join(base_dir, 'grammar_notes.md'),
            'settings_file': os.path.join(base_dir, 'settings.json')
        }
    
    def to_dict(self):
        """Convert user to dictionary for API responses."""
        return {
            'id': self.id,
            'email': self.email,
            'display_name': self.display_name,
            'provider': self.provider,
            'profile_picture_url': self.profile_picture_url,
            'created_at': self.created_at.isoformat(),
            'user_directory_id': self.get_user_directory_id()
        }


class UserSession(db.Model):
    """User session tracking for security and analytics."""
    
    __tablename__ = 'user_sessions'
    
    id = db.Column(db.Integer, primary_key=True)
    session_id = db.Column(db.String(255), unique=True, nullable=False, index=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    ip_address = db.Column(db.String(45), nullable=True)  # IPv4 or IPv6
    user_agent = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    expires_at = db.Column(db.DateTime, nullable=False)
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    
    def __repr__(self):
        return f'<UserSession {self.session_id} for User {self.user_id}>'
    
    def is_expired(self):
        """Check if the session has expired."""
        return datetime.utcnow() > self.expires_at
    
    def extend_expiration(self, hours=24):
        """Extend session expiration time."""
        self.expires_at = datetime.utcnow() + timedelta(hours=hours)
    
    @classmethod
    def cleanup_expired_sessions(cls):
        """Remove expired sessions from the database."""
        expired_sessions = cls.query.filter(cls.expires_at < datetime.utcnow()).all()
        for session in expired_sessions:
            db.session.delete(session)
        db.session.commit()
        return len(expired_sessions)


class UserPreference(db.Model):
    """User preferences and settings."""
    
    __tablename__ = 'user_preferences'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    key = db.Column(db.String(100), nullable=False)
    value = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    __table_args__ = (db.UniqueConstraint('user_id', 'key', name='unique_user_preference'),)
    
    def __repr__(self):
        return f'<UserPreference {self.key}={self.value} for User {self.user_id}>'
    
    @classmethod
    def get_user_preferences(cls, user_id):
        """Get all preferences for a user as a dictionary."""
        preferences = cls.query.filter_by(user_id=user_id).all()
        return {pref.key: pref.value for pref in preferences}
    
    @classmethod
    def set_user_preference(cls, user_id, key, value):
        """Set a user preference, creating or updating as needed."""
        preference = cls.query.filter_by(user_id=user_id, key=key).first()
        if preference:
            preference.value = value
            preference.updated_at = datetime.utcnow()
        else:
            preference = cls(user_id=user_id, key=key, value=value)
            db.session.add(preference)
        db.session.commit()
        return preference


def init_database(app):
    """Initialize the database with the Flask app."""
    db.init_app(app)
    
    with app.app_context():
        # Create all tables
        db.create_all()
        
        # Set up default preferences for new users
        app.logger.info("Database initialized successfully")


def create_default_preferences(user_id):
    """Create default preferences for a new user."""
    default_prefs = {
        'ollama_host': 'localhost:11434',
        'model': 'llama3',
        'theme': 'light',
        'language_preference': 'en',
        'notifications_enabled': 'true'
    }
    
    for key, value in default_prefs.items():
        UserPreference.set_user_preference(user_id, key, value)