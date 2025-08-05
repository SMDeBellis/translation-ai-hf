#!/usr/bin/env python3
"""
Spanish Tutor Web GUI - Flask Application

A web-based interface for the Spanish tutoring chatbot using Flask and WebSockets.
Provides a modern, responsive chat interface with user authentication.
"""

import os
import sys
import json
import importlib.util
from datetime import datetime
from typing import Dict, List, Optional
import threading
import queue
import logging
from logging.handlers import RotatingFileHandler

from flask import Flask, render_template, request, jsonify, send_file, send_from_directory
from flask_socketio import SocketIO, emit, disconnect
from flask_cors import CORS
from flask_login import LoginManager, current_user
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

from web_gui.models import db, User, UserSession, init_database
from web_gui.auth import auth_bp, require_auth_api

# Add parent directory to path to import the chatbot
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Import the existing chatbot logic
parent_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
spanish_tutor_path = os.path.join(parent_dir, "spanish-tutor.py")
spec = importlib.util.spec_from_file_location("spanish_tutor", spanish_tutor_path)
spanish_tutor_module = importlib.util.module_from_spec(spec)
sys.modules["spanish_tutor"] = spanish_tutor_module
spec.loader.exec_module(spanish_tutor_module)

SpanishTutorChatbot = spanish_tutor_module.SpanishTutorChatbot

# Initialize Flask app
app = Flask(__name__, static_folder='static/dist', static_url_path='/static')

# Configuration
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'spanish-tutor-secret-key-change-in-production')
app.config['DEBUG'] = os.environ.get('FLASK_DEBUG', 'True').lower() == 'true'

# Database configuration
app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('DATABASE_URL', 'sqlite:///spanish_tutor.db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# OAuth configuration
app.config['GOOGLE_CLIENT_ID'] = os.environ.get('GOOGLE_CLIENT_ID')
app.config['FACEBOOK_APP_ID'] = os.environ.get('FACEBOOK_APP_ID')
app.config['FACEBOOK_APP_SECRET'] = os.environ.get('FACEBOOK_APP_SECRET')

# Set up file logging
if not app.debug or os.environ.get('WERKZEUG_RUN_MAIN') == 'true':
    log_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'logs')
    if not os.path.exists(log_dir):
        os.makedirs(log_dir)
    
    file_handler = RotatingFileHandler(
        os.path.join(log_dir, 'spanish-tutor.log'), 
        maxBytes=10240000, 
        backupCount=10
    )
    file_handler.setFormatter(logging.Formatter(
        '%(asctime)s %(levelname)s: %(message)s [in %(pathname)s:%(lineno)d]'
    ))
    file_handler.setLevel(logging.INFO)
    app.logger.addHandler(file_handler)
    app.logger.setLevel(logging.INFO)
    app.logger.info('Spanish Tutor Web GUI startup')

# Initialize extensions
init_database(app)
CORS(app)

# Initialize Flask-Login
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'auth.login'
login_manager.login_message = 'Please log in to access this page.'

# Initialize rate limiter
limiter = Limiter(
    key_func=get_remote_address,
    default_limits=["200 per day", "50 per hour"]
)
limiter.init_app(app)

# Register authentication routes
app.register_blueprint(auth_bp)

# Initialize SocketIO
socketio = SocketIO(app, cors_allowed_origins="*", logger=True, engineio_logger=True)

@login_manager.user_loader
def load_user(user_id):
    """Load user for Flask-Login."""
    return User.query.get(int(user_id))

# Global chatbot instances (one per session)
chatbots: Dict[str, SpanishTutorChatbot] = {}
chatbot_lock = threading.Lock()

class WebChatbotManager:
    """Manages chatbot instances for authenticated users."""
    
    def __init__(self):
        self.chatbots = {}
        self.lock = threading.Lock()
    
    def get_chatbot(self, user: User, ollama_host: str = "localhost:11434", model: str = "llama3") -> SpanishTutorChatbot:
        """Get or create a chatbot instance for an authenticated user."""
        with self.lock:
            user_key = f"user_{user.id}"
            if user_key not in self.chatbots:
                try:
                    app.logger.info(f"Creating new chatbot for user {user.email} with model {model}")
                    
                    # Get user-specific paths
                    user_paths = user.get_data_paths()
                    
                    # Ensure user directories exist
                    os.makedirs(user_paths['conversations_dir'], exist_ok=True)
                    os.makedirs(os.path.dirname(user_paths['grammar_notes_file']), exist_ok=True)
                    
                    # Create chatbot with user-specific info
                    user_info = {
                        'user_id': user_paths['user_id'],
                        'conversations_dir': user_paths['conversations_dir'],
                        'grammar_notes_file': user_paths['grammar_notes_file']
                    }
                    
                    self.chatbots[user_key] = SpanishTutorChatbot(
                        ollama_host=ollama_host,
                        model=model,
                        user_info=user_info
                    )
                    app.logger.info(f"Chatbot created successfully for user {user.email}")
                except Exception as e:
                    app.logger.error(f"Failed to create chatbot for user {user.email}: {e}")
                    raise
            return self.chatbots[user_key]
    
    def remove_chatbot(self, user_id: int):
        """Remove a chatbot instance when user logs out."""
        with self.lock:
            user_key = f"user_{user_id}"
            if user_key in self.chatbots:
                # Save conversation before removing
                try:
                    chatbot = self.chatbots[user_key]
                    if hasattr(chatbot, 'save_conversation'):
                        chatbot.save_conversation()
                except Exception as e:
                    app.logger.error(f"Failed to save conversation for user {user_id}: {e}")
                
                del self.chatbots[user_key]
    
    def get_active_user_count(self) -> int:
        """Get number of active user chatbots."""
        with self.lock:
            return len(self.chatbots)

# Initialize chatbot manager
chatbot_manager = WebChatbotManager()

# React SPA routes
@app.route('/')
@app.route('/conversations')
@app.route('/grammar-notes')
@app.route('/settings')
def index():
    """Serve the React SPA for all frontend routes."""
    try:
        # Try to serve the React build first
        return send_from_directory(app.static_folder, 'index.html')
    except:
        # Fallback to development message if React build doesn't exist
        return '''
        <html>
        <head><title>Spanish Tutor - React Development</title></head>
        <body>
            <h1>Spanish Tutor React Frontend</h1>
            <p>The React build is not available. Please run:</p>
            <pre>cd frontend && npm run build</pre>
            <p>Or for development:</p>
            <pre>cd frontend && npm run dev</pre>
            <p>The development server will be available at <a href="http://localhost:3001">http://localhost:3001</a></p>
        </body>
        </html>
        '''

# Static asset routes for React build
@app.route('/assets/<path:filename>')
def react_assets(filename):
    """Serve React build assets."""
    return send_from_directory(os.path.join(app.static_folder, 'assets'), filename)

# API Routes
@app.route('/api/health')
def health_check():
    """Health check endpoint."""
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.now().isoformat(),
        'active_users': chatbot_manager.get_active_user_count() if current_user.is_authenticated else 0,
        'authenticated': current_user.is_authenticated
    })

@app.route('/api/ollama/status')
def ollama_status():
    """Check Ollama connection status."""
    try:
        # Create a temporary chatbot to test connection
        temp_chatbot = SpanishTutorChatbot()
        is_connected = temp_chatbot.check_ollama_connection()
        return jsonify({
            'connected': is_connected,
            'host': temp_chatbot.ollama_host,
            'timestamp': datetime.now().isoformat()
        })
    except Exception as e:
        return jsonify({
            'connected': False,
            'error': str(e),
            'timestamp': datetime.now().isoformat()
        }), 500

@app.route('/api/conversations/list')
@require_auth_api
def list_conversations():
    """List all saved conversations for the authenticated user."""
    try:
        # Get user's chatbot instance
        chatbot = chatbot_manager.get_chatbot(current_user)
        conversations = chatbot.list_conversations()
        
        app.logger.info(f"Listed {len(conversations)} conversations for user {current_user.email}")
        
        return jsonify({
            'conversations': conversations,
            'count': len(conversations),
            'user_id': current_user.get_user_directory_id()
        })
    except Exception as e:
        app.logger.error(f"Error listing conversations for user {current_user.email}: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/conversations/latest')
@require_auth_api
def get_latest_conversation():
    """Get the latest conversation for the authenticated user."""
    try:
        # Get user's chatbot instance
        chatbot = chatbot_manager.get_chatbot(current_user)
        
        # Use the backend's method to find the latest conversation
        conversations = chatbot.list_conversations()
        
        if not conversations:
            return jsonify({
                'exists': False,
                'message': 'No conversations found',
                'user_id': current_user.get_user_directory_id()
            })
        
        # Get the latest conversation (first in the list since they're sorted by date desc)
        latest_conversation = conversations[0]
        conversation_file = os.path.basename(latest_conversation['file'])
        
        # Load the conversation data
        with open(latest_conversation['file'], 'r', encoding='utf-8') as f:
            conversation_data = json.load(f)
        
        app.logger.info(f"Retrieved latest conversation {conversation_file} for user {current_user.email}")
        
        return jsonify({
            'exists': True,
            'filename': conversation_file,
            'session_start': latest_conversation['session_start'],
            'exchanges': latest_conversation['exchanges'],
            'conversation': conversation_data.get('conversation', []),
            'user_id': current_user.get_user_directory_id()
        })
    except Exception as e:
        app.logger.error(f"Error getting latest conversation for user {current_user.email}: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/conversations/<path:filename>')
@require_auth_api
def get_conversation(filename):
    """Get a specific conversation file for the authenticated user."""
    try:
        # Get user's chatbot instance
        chatbot = chatbot_manager.get_chatbot(current_user)
        conversation_path = os.path.join(chatbot.conversations_dir, filename)
        
        if not os.path.exists(conversation_path):
            return jsonify({'error': 'Conversation not found'}), 404
        
        # Security check: ensure the file is within the user's directory
        user_paths = current_user.get_data_paths()
        if not conversation_path.startswith(user_paths['conversations_dir']):
            return jsonify({'error': 'Access denied'}), 403
        
        with open(conversation_path, 'r', encoding='utf-8') as f:
            conversation_data = json.load(f)
        
        return jsonify(conversation_data)
    except Exception as e:
        app.logger.error(f"Error getting conversation {filename} for user {current_user.email}: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/grammar-notes')
@require_auth_api
def get_grammar_notes():
    """Get grammar notes content for the authenticated user."""
    try:
        # Get user's chatbot instance
        chatbot = chatbot_manager.get_chatbot(current_user)
        
        if not os.path.exists(chatbot.grammar_notes_file):
            return jsonify({
                'content': '',
                'exists': False,
                'message': 'No grammar notes file found',
                'user_id': current_user.get_user_directory_id()
            })
        
        with open(chatbot.grammar_notes_file, 'r', encoding='utf-8') as f:
            content = f.read()
        
        return jsonify({
            'content': content,
            'exists': True,
            'file_size': os.path.getsize(chatbot.grammar_notes_file),
            'user_id': current_user.get_user_directory_id()
        })
    except Exception as e:
        app.logger.error(f"Error getting grammar notes for user {current_user.email}: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/grammar-notes/export')
@require_auth_api
def export_grammar_notes():
    """Export grammar notes as a file for the authenticated user."""
    try:
        # Get user's chatbot instance
        chatbot = chatbot_manager.get_chatbot(current_user)
        
        if not os.path.exists(chatbot.grammar_notes_file):
            return jsonify({'error': 'No grammar notes to export'}), 404
        
        user_id = current_user.get_user_directory_id()
        filename = f'spanish_grammar_notes_{user_id}_{datetime.now().strftime("%Y%m%d")}.md'
        
        return send_file(
            chatbot.grammar_notes_file,
            as_attachment=True,
            download_name=filename,
            mimetype='text/markdown'
        )
    except Exception as e:
        app.logger.error(f"Error exporting grammar notes for user {current_user.email}: {e}")
        return jsonify({'error': str(e)}), 500

# WebSocket Events
@socketio.on('connect')
def handle_connect():
    """Handle client connection with authentication check."""
    session_id = request.sid
    app.logger.info(f"Client connected: {session_id}")
    
    try:
        # Check if user is authenticated
        if not current_user.is_authenticated:
            app.logger.warning(f"Unauthenticated connection attempt: {session_id}")
            emit('auth_required', {
                'message': 'Authentication required to use Spanish Tutor'
            })
            return
        
        # Initialize chatbot for this authenticated user
        chatbot = chatbot_manager.get_chatbot(current_user)
        
        # Load latest conversation into chatbot instance if it exists
        try:
            if not chatbot.conversation_history:  # Only load if no conversation is active
                loaded = chatbot.load_latest_conversation()
                if loaded:
                    app.logger.info(f"Loaded latest conversation for user {current_user.email} - {len(chatbot.conversation_history)} exchanges")
        except Exception as e:
            app.logger.error(f"Failed to load latest conversation for user {current_user.email}: {e}")
        
        # Check Ollama connection
        is_connected = chatbot.check_ollama_connection()
        
        emit('connection_status', {
            'connected': is_connected,
            'session_id': session_id,
            'user_id': current_user.get_user_directory_id(),
            'user_email': current_user.email,
            'message': 'Connected to Spanish Tutor' if is_connected else 'Failed to connect to Ollama'
        })
        
        app.logger.info(f"User {current_user.email} connected with session {session_id}")
        
    except Exception as e:
        app.logger.error(f"Error during connection for user {current_user.email if current_user.is_authenticated else 'anonymous'}: {e}")
        emit('error', {'message': f'Failed to initialize: {str(e)}'})

@socketio.on('disconnect')
def handle_disconnect():
    """Handle client disconnection."""
    session_id = request.sid
    app.logger.info(f"Client disconnected: {session_id}")
    
    # Note: We don't remove chatbot instance on disconnect
    # Only remove when user explicitly logs out
    # This allows reconnection without losing conversation state
    if current_user.is_authenticated:
        app.logger.info(f"User {current_user.email} disconnected from session {session_id}")
    else:
        app.logger.info(f"Anonymous user disconnected from session {session_id}")

@socketio.on('send_message')
def handle_message(data):
    """Handle incoming chat messages from authenticated users."""
    session_id = request.sid
    user_message = data.get('message', '').strip()
    
    # Check authentication
    if not current_user.is_authenticated:
        emit('auth_required', {'message': 'Authentication required'})
        return
    
    if not user_message:
        emit('error', {'message': 'Empty message received'})
        return
    
    try:
        # Get chatbot for this authenticated user
        chatbot = chatbot_manager.get_chatbot(current_user)
        
        # Echo user message back to client
        emit('user_message', {
            'message': user_message,
            'timestamp': datetime.now().isoformat()
        })
        
        # Process message synchronously for now to debug
        try:
            app.logger.info(f"Processing message from user {current_user.email}: {user_message}")
            response = chatbot.send_message(user_message)
            app.logger.info(f"Got response for user {current_user.email}: {response[:100]}...")
            
            # Send bot response back to the client
            emit('bot_message', {
                'message': response,
                'timestamp': datetime.now().isoformat()
            })
            app.logger.info(f"Sent bot_message to user {current_user.email}")
            
        except Exception as e:
            app.logger.error(f"Error processing message for user {current_user.email}: {e}")
            emit('error', {
                'message': f'Error processing message: {str(e)}'
            })
        
    except Exception as e:
        app.logger.error(f"Error handling message for user {current_user.email if current_user.is_authenticated else 'anonymous'}: {e}")
        emit('error', {'message': f'Error: {str(e)}'})

@socketio.on('new_conversation')
def handle_new_conversation(data=None):
    """Handle new conversation request for authenticated users."""
    session_id = request.sid
    
    # Check authentication
    if not current_user.is_authenticated:
        emit('auth_required', {'message': 'Authentication required'})
        return
    
    app.logger.info(f"🔄 RECEIVED new_conversation event for user {current_user.email}")
    
    try:
        app.logger.info(f"Starting new conversation for user {current_user.email}")
        
        chatbot = chatbot_manager.get_chatbot(current_user)
        app.logger.info(f"Got chatbot instance for user {current_user.email}")
        
        # Clear the conversation history
        chatbot.start_new_conversation()
        app.logger.info(f"Conversation history cleared for user {current_user.email}")
        
        # Emit conversation cleared event
        emit('conversation_cleared', {
            'message': 'Started new conversation',
            'timestamp': datetime.now().isoformat()
        })
        app.logger.info(f"✅ Sent conversation_cleared event for user {current_user.email}")
        
    except Exception as e:
        error_msg = f"❌ Error starting new conversation for user {current_user.email}: {e}"
        app.logger.error(error_msg)
        emit('error', {'message': f'Error: {str(e)}'})

@socketio.on('set_active_conversation')
def handle_set_active_conversation(data):
    """Handle setting the active conversation in the backend."""
    session_id = request.sid
    filename = data.get('filename')
    
    # Check authentication
    if not current_user.is_authenticated:
        emit('auth_required', {'message': 'Authentication required'})
        return
    
    app.logger.info(f"Setting active conversation to {filename} for user {current_user.email}")
    
    try:
        chatbot = chatbot_manager.get_chatbot(current_user)
        
        if filename:
            conversation_path = os.path.join(chatbot.conversations_dir, filename)
            
            if os.path.exists(conversation_path):
                # Load the specific conversation into the backend
                if chatbot.load_conversation(conversation_path):
                    app.logger.info(f"Backend loaded active conversation {filename} with {len(chatbot.conversation_history)} exchanges")
                else:
                    app.logger.error(f"Failed to load active conversation {filename}")
            else:
                app.logger.warning(f"Active conversation file not found: {conversation_path}")
        else:
            # Clear the conversation if no filename provided
            chatbot.conversation_history = []
            chatbot.current_conversation_file = None
            app.logger.info("Cleared active conversation in backend")
            
    except Exception as e:
        app.logger.error(f"Error setting active conversation: {e}")

@socketio.on('load_conversation')
def handle_load_conversation(data):
    """Handle load conversation request for authenticated users."""
    session_id = request.sid
    filename = data.get('filename')
    
    # Check authentication
    if not current_user.is_authenticated:
        emit('auth_required', {'message': 'Authentication required'})
        return
    
    app.logger.info(f"Received load_conversation request for {filename} from user {current_user.email}")
    
    if not filename:
        app.logger.error("No filename provided in load_conversation request")
        emit('error', {'message': 'No filename provided'})
        return
    
    try:
        chatbot = chatbot_manager.get_chatbot(current_user)
        conversation_path = os.path.join(chatbot.conversations_dir, filename)
        
        app.logger.info(f"Loading conversation from path: {conversation_path}")
        app.logger.info(f"File exists: {os.path.exists(conversation_path)}")
        
        if chatbot.load_conversation(conversation_path):
            app.logger.info(f"Conversation loaded successfully. History length: {len(chatbot.conversation_history)}")
            
            # Send conversation history to client
            conversation_data = []
            for exchange in chatbot.conversation_history:
                conversation_data.extend([
                    {
                        'type': 'user',
                        'message': exchange.get('user', ''),
                        'timestamp': exchange.get('timestamp', datetime.now().isoformat())
                    },
                    {
                        'type': 'bot', 
                        'message': exchange.get('bot', ''),
                        'timestamp': exchange.get('timestamp', datetime.now().isoformat())
                    }
                ])
            
            app.logger.info(f"Sending {len(conversation_data)} messages to client session {session_id}")
            emit('conversation_loaded', {
                'messages': conversation_data,
                'filename': filename,
                'count': len(chatbot.conversation_history)
            })
            app.logger.info(f"Emitted conversation_loaded event to session {session_id}")
        else:
            app.logger.error(f"Failed to load conversation from {conversation_path}")
            emit('error', {'message': 'Failed to load conversation'})
            
    except Exception as e:
        app.logger.error(f"Error loading conversation: {e}")
        emit('error', {'message': f'Error: {str(e)}'})

if __name__ == '__main__':
    # Run the development server
    print("Starting Spanish Tutor Web GUI...")
    print("Open your browser to: http://localhost:8080")
    socketio.run(app, host='0.0.0.0', port=8080, debug=True)