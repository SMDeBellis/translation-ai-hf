#!/usr/bin/env python3
"""
Spanish Tutor Web GUI - Flask Application

A web-based interface for the Spanish tutoring chatbot using Flask and WebSockets.
Provides a modern, responsive chat interface with real-time messaging.
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
app.config['SECRET_KEY'] = 'spanish-tutor-secret-key-change-in-production'
app.config['DEBUG'] = True

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

# Enable CORS for development
CORS(app)

# Initialize SocketIO
socketio = SocketIO(app, cors_allowed_origins="*", logger=True, engineio_logger=True)

# Global chatbot instances (one per session)
chatbots: Dict[str, SpanishTutorChatbot] = {}
chatbot_lock = threading.Lock()

class WebChatbotManager:
    """Manages chatbot instances for web sessions."""
    
    def __init__(self):
        self.chatbots = {}
        self.lock = threading.Lock()
    
    def get_chatbot(self, session_id: str, ollama_host: str = "localhost:11434", model: str = "llama3") -> SpanishTutorChatbot:
        """Get or create a chatbot instance for a session."""
        with self.lock:
            if session_id not in self.chatbots:
                try:
                    app.logger.info(f"Creating new chatbot for session {session_id} with model {model}")
                    self.chatbots[session_id] = SpanishTutorChatbot(
                        ollama_host=ollama_host,
                        model=model
                    )
                    app.logger.info(f"Chatbot created successfully for session {session_id}")
                except Exception as e:
                    app.logger.error(f"Failed to create chatbot for session {session_id}: {e}")
                    raise
            return self.chatbots[session_id]
    
    def remove_chatbot(self, session_id: str):
        """Remove a chatbot instance when session ends."""
        with self.lock:
            if session_id in self.chatbots:
                # Save conversation before removing
                try:
                    chatbot = self.chatbots[session_id]
                    if hasattr(chatbot, 'save_conversation'):
                        chatbot.save_conversation()
                except Exception as e:
                    app.logger.error(f"Failed to save conversation for session {session_id}: {e}")
                
                del self.chatbots[session_id]
    
    def get_session_count(self) -> int:
        """Get number of active sessions."""
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
        'active_sessions': chatbot_manager.get_session_count()
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
def list_conversations():
    """List all saved conversations."""
    try:
        # Create temporary chatbot to access conversation methods
        temp_chatbot = SpanishTutorChatbot()
        conversations = temp_chatbot.list_conversations()
        return jsonify({
            'conversations': conversations,
            'count': len(conversations)
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/conversations/<path:filename>')
def get_conversation(filename):
    """Get a specific conversation file."""
    try:
        temp_chatbot = SpanishTutorChatbot()
        conversation_path = os.path.join(temp_chatbot.conversations_dir, filename)
        
        if not os.path.exists(conversation_path):
            return jsonify({'error': 'Conversation not found'}), 404
        
        with open(conversation_path, 'r', encoding='utf-8') as f:
            conversation_data = json.load(f)
        
        return jsonify(conversation_data)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/grammar-notes')
def get_grammar_notes():
    """Get grammar notes content."""
    try:
        temp_chatbot = SpanishTutorChatbot()
        
        if not os.path.exists(temp_chatbot.grammar_notes_file):
            return jsonify({
                'content': '',
                'exists': False,
                'message': 'No grammar notes file found'
            })
        
        with open(temp_chatbot.grammar_notes_file, 'r', encoding='utf-8') as f:
            content = f.read()
        
        return jsonify({
            'content': content,
            'exists': True,
            'file_size': os.path.getsize(temp_chatbot.grammar_notes_file)
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/grammar-notes/export')
def export_grammar_notes():
    """Export grammar notes as a file."""
    try:
        temp_chatbot = SpanishTutorChatbot()
        
        if not os.path.exists(temp_chatbot.grammar_notes_file):
            return jsonify({'error': 'No grammar notes to export'}), 404
        
        return send_file(
            temp_chatbot.grammar_notes_file,
            as_attachment=True,
            download_name=f'spanish_grammar_notes_{datetime.now().strftime("%Y%m%d")}.md',
            mimetype='text/markdown'
        )
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# WebSocket Events
@socketio.on('connect')
def handle_connect():
    """Handle client connection."""
    session_id = request.sid
    app.logger.info(f"Client connected: {session_id}")
    
    try:
        # Initialize chatbot for this session
        chatbot = chatbot_manager.get_chatbot(session_id)
        
        # Check Ollama connection
        is_connected = chatbot.check_ollama_connection()
        
        emit('connection_status', {
            'connected': is_connected,
            'session_id': session_id,
            'message': 'Connected to Spanish Tutor' if is_connected else 'Failed to connect to Ollama'
        })
        
        # Welcome message is handled by static HTML template
        # No need to send additional welcome messages via WebSocket
        
    except Exception as e:
        app.logger.error(f"Error during connection: {e}")
        emit('error', {'message': f'Failed to initialize: {str(e)}'})

@socketio.on('disconnect')
def handle_disconnect():
    """Handle client disconnection."""
    session_id = request.sid
    app.logger.info(f"Client disconnected: {session_id}")
    
    # Clean up chatbot instance
    chatbot_manager.remove_chatbot(session_id)

@socketio.on('send_message')
def handle_message(data):
    """Handle incoming chat messages."""
    session_id = request.sid
    user_message = data.get('message', '').strip()
    
    if not user_message:
        emit('error', {'message': 'Empty message received'})
        return
    
    try:
        # Get chatbot for this session
        chatbot = chatbot_manager.get_chatbot(session_id)
        
        # Echo user message back to client
        emit('user_message', {
            'message': user_message,
            'timestamp': datetime.now().isoformat()
        })
        
        # Process message synchronously for now to debug
        try:
            app.logger.info(f"Processing message from {session_id}: {user_message}")
            response = chatbot.send_message(user_message)
            app.logger.info(f"Got response for {session_id}: {response[:100]}...")
            
            # Send bot response back to the client
            emit('bot_message', {
                'message': response,
                'timestamp': datetime.now().isoformat()
            })
            app.logger.info(f"Sent bot_message to {session_id}")
            
        except Exception as e:
            app.logger.error(f"Error processing message: {e}")
            emit('error', {
                'message': f'Error processing message: {str(e)}'
            })
        
    except Exception as e:
        app.logger.error(f"Error handling message: {e}")
        emit('error', {'message': f'Error: {str(e)}'})

@socketio.on('new_conversation')
def handle_new_conversation(data=None):
    """Handle new conversation request."""
    session_id = request.sid
    
    app.logger.info(f"🔄 RECEIVED new_conversation event for session {session_id}")
    print(f"🔄 RECEIVED new_conversation event for session {session_id}")
    
    try:
        app.logger.info(f"Starting new conversation for session {session_id}")
        print(f"Starting new conversation for session {session_id}")
        
        chatbot = chatbot_manager.get_chatbot(session_id)
        app.logger.info(f"Got chatbot instance for session {session_id}")
        print(f"Got chatbot instance for session {session_id}")
        
        # Clear the conversation history
        chatbot.start_new_conversation()
        app.logger.info(f"Conversation history cleared for session {session_id}")
        print(f"Conversation history cleared for session {session_id}")
        
        # Emit conversation cleared event
        emit('conversation_cleared', {
            'message': 'Started new conversation',
            'timestamp': datetime.now().isoformat()
        })
        app.logger.info(f"✅ Sent conversation_cleared event for session {session_id}")
        print(f"✅ Sent conversation_cleared event for session {session_id}")
        
    except Exception as e:
        error_msg = f"❌ Error starting new conversation: {e}"
        app.logger.error(error_msg)
        print(error_msg)
        import traceback
        print(traceback.format_exc())
        emit('error', {'message': f'Error: {str(e)}'})

@socketio.on('load_conversation')
def handle_load_conversation(data):
    """Handle load conversation request."""
    session_id = request.sid
    filename = data.get('filename')
    
    app.logger.info(f"Received load_conversation request for {filename} from session {session_id}")
    
    if not filename:
        app.logger.error("No filename provided in load_conversation request")
        emit('error', {'message': 'No filename provided'})
        return
    
    try:
        chatbot = chatbot_manager.get_chatbot(session_id)
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