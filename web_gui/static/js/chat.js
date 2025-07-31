// Chat interface JavaScript for Spanish Tutor Web GUI

class ChatInterface {
    constructor() {
        this.socket = null;
        this.messageInput = document.getElementById('message-input');
        this.sendButton = document.getElementById('send-btn');
        this.messagesContainer = document.getElementById('chat-messages');
        this.newConversationBtn = document.getElementById('new-conversation-btn');
        this.loadConversationBtn = document.getElementById('load-conversation-btn');
        
        this.isTyping = false;
        this.messageQueue = [];
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.setupSocketConnection();
        this.adjustTextareaHeight();
    }

    setupEventListeners() {
        // Message input events
        this.messageInput.addEventListener('input', () => {
            this.adjustTextareaHeight();
            this.updateSendButton();
        });

        this.messageInput.addEventListener('keydown', (e) => {
            // Ctrl+Enter or Cmd+Enter to send
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                this.sendMessage();
            }
            
            // Ctrl+L to clear input
            if ((e.ctrlKey || e.metaKey) && e.key === 'l') {
                e.preventDefault();
                this.clearInput();
            }
        });

        // Send button
        this.sendButton.addEventListener('click', () => {
            this.sendMessage();
        });

        // New conversation button
        this.newConversationBtn.addEventListener('click', () => {
            this.startNewConversation();
        });

        // Load conversation button
        this.loadConversationBtn.addEventListener('click', () => {
            this.showLoadConversationDialog();
        });

        // Global keyboard shortcuts for chat page
        document.addEventListener('keydown', (e) => {
            // Ctrl+N for new conversation
            if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
                e.preventDefault();
                this.startNewConversation();
            }
        });
    }

    setupSocketConnection() {
        this.socket = socketManager.connect();

        // Chat-specific socket events
        this.socket.on('user_message', (data) => {
            // Message echo from server (confirmation)
            console.log('Message sent successfully');
        });

        this.socket.on('bot_message', (data) => {
            console.log('Received bot_message:', data);
            this.addBotMessage(data.message, data.timestamp);
            this.setTypingIndicator(false);
        });

        this.socket.on('system_message', (data) => {
            this.addSystemMessage(data.message, data.timestamp);
        });

        this.socket.on('conversation_cleared', (data) => {
            this.clearMessages();
            this.addSystemMessage('Started new conversation', data.timestamp);
            utils.showToast('New conversation started', 'success');
        });

        this.socket.on('conversation_loaded', (data) => {
            this.loadConversationMessages(data.messages);
            utils.showToast(`Loaded conversation with ${data.count} exchanges`, 'success');
        });

        this.socket.on('connection_status', (data) => {
            // Keep welcome message visible - it will be hidden when user sends first message
        });
    }

    adjustTextareaHeight() {
        const textarea = this.messageInput;
        textarea.style.height = 'auto';
        const scrollHeight = textarea.scrollHeight;
        const maxHeight = 120; // max-height from CSS
        textarea.style.height = Math.min(scrollHeight, maxHeight) + 'px';
    }

    updateSendButton() {
        const message = this.messageInput.value.trim();
        const isConnected = window.SpanishTutor.isConnected;
        
        this.sendButton.disabled = !message || !isConnected || this.isTyping;
    }

    clearInput() {
        this.messageInput.value = '';
        this.adjustTextareaHeight();
        this.updateSendButton();
        this.messageInput.focus();
    }

    sendMessage() {
        const message = this.messageInput.value.trim();
        
        if (!message || !this.socket || this.isTyping) {
            return;
        }

        // Add user message to UI immediately
        this.addUserMessage(message);
        
        // Clear input
        this.clearInput();
        
        // Show typing indicator
        this.setTypingIndicator(true);
        
        // Send to server
        console.log('Sending message:', message);
        this.socket.emit('send_message', { message });
    }

    addUserMessage(message, timestamp = null) {
        const messageElement = this.createMessageElement('user', message, timestamp);
        this.appendMessage(messageElement);
    }

    addBotMessage(message, timestamp = null) {
        const messageElement = this.createMessageElement('bot', message, timestamp);
        this.appendMessage(messageElement);
    }

    addSystemMessage(message, timestamp = null) {
        const messageElement = this.createMessageElement('system', message, timestamp);
        this.appendMessage(messageElement);
    }

    createMessageElement(type, message, timestamp = null) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}`;

        const avatar = document.createElement('div');
        avatar.className = 'message-avatar';
        
        if (type === 'user') {
            avatar.textContent = '👤';
        } else if (type === 'bot') {
            avatar.textContent = '🎓';
        } else {
            avatar.textContent = 'ℹ️';
        }

        const content = document.createElement('div');
        content.className = 'message-content';

        const text = document.createElement('div');
        text.className = 'message-text';
        text.textContent = message;

        const time = document.createElement('small');
        time.className = 'message-timestamp';
        time.textContent = timestamp 
            ? utils.formatTimestamp(timestamp)
            : utils.formatTimestamp(new Date().toISOString());

        content.appendChild(text);
        content.appendChild(time);

        messageDiv.appendChild(avatar);
        messageDiv.appendChild(content);

        return messageDiv;
    }

    appendMessage(messageElement) {
        // Remove welcome message if it exists
        this.hideWelcomeMessage();

        this.messagesContainer.appendChild(messageElement);
        this.scrollToBottom();
    }

    hideWelcomeMessage() {
        const welcomeMessage = this.messagesContainer.querySelector('.welcome-message');
        if (welcomeMessage) {
            welcomeMessage.style.display = 'none';
        }
    }

    scrollToBottom() {
        this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    }

    setTypingIndicator(isTyping) {
        this.isTyping = isTyping;
        this.updateSendButton();

        // Remove existing typing indicator
        const existingIndicator = this.messagesContainer.querySelector('.typing-indicator');
        if (existingIndicator) {
            existingIndicator.remove();
        }

        if (isTyping) {
            const typingDiv = document.createElement('div');
            typingDiv.className = 'message bot typing-indicator';
            typingDiv.innerHTML = `
                <div class="message-avatar">🎓</div>
                <div class="message-content">
                    <div class="typing-dots">
                        <span></span>
                        <span></span>
                        <span></span>
                    </div>
                </div>
            `;

            // Add typing animation styles
            if (!document.getElementById('typing-styles')) {
                const styles = document.createElement('style');
                styles.id = 'typing-styles';
                styles.textContent = `
                    .typing-dots {
                        display: flex;
                        gap: 4px;
                        padding: 8px 0;
                    }
                    .typing-dots span {
                        width: 8px;
                        height: 8px;
                        border-radius: 50%;
                        background-color: #9ca3af;
                        animation: typingBounce 1.4s ease-in-out infinite both;
                    }
                    .typing-dots span:nth-child(1) { animation-delay: -0.32s; }
                    .typing-dots span:nth-child(2) { animation-delay: -0.16s; }
                    .typing-dots span:nth-child(3) { animation-delay: 0s; }
                    @keyframes typingBounce {
                        0%, 80%, 100% {
                            transform: scale(0);
                            opacity: 0.5;
                        }
                        40% {
                            transform: scale(1);
                            opacity: 1;
                        }
                    }
                `;
                document.head.appendChild(styles);
            }

            this.messagesContainer.appendChild(typingDiv);
            this.scrollToBottom();
        }
    }

    clearMessages() {
        // Remove all messages except welcome message
        const messages = this.messagesContainer.querySelectorAll('.message');
        messages.forEach(message => message.remove());

        // Show welcome message again
        const welcomeMessage = this.messagesContainer.querySelector('.welcome-message');
        if (welcomeMessage) {
            welcomeMessage.style.display = 'block';
        }
    }

    startNewConversation() {
        if (!this.socket) {
            utils.showToast('Not connected to server', 'error');
            return;
        }

        if (confirm('Start a new conversation? Current conversation will be saved automatically.')) {
            this.socket.emit('new_conversation');
        }
    }

    async showLoadConversationDialog() {
        try {
            const data = await api.getConversations();
            
            if (data.conversations.length === 0) {
                utils.showToast('No saved conversations found', 'info');
                return;
            }

            this.showConversationPicker(data.conversations);
        } catch (error) {
            console.error('Failed to load conversations:', error);
            utils.showToast('Failed to load conversations', 'error');
        }
    }

    showConversationPicker(conversations) {
        // Create modal for conversation selection
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.display = 'flex';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Load Conversation</h3>
                    <button class="modal-close">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="conversation-list">
                        ${conversations.map((conv, index) => `
                            <div class="conversation-item" data-filename="${utils.escapeHtml(conv.file.split('/').pop())}">
                                <div class="conversation-info">
                                    <div class="conversation-date">
                                        ${utils.formatDetailedTimestamp(conv.session_start)}
                                    </div>
                                    <div class="conversation-details">
                                        ${conv.exchanges} exchanges • ${conv.model} • ${Math.round(conv.file_size / 1024)}KB
                                    </div>
                                </div>
                                <button class="btn btn-primary btn-sm load-conversation-btn">Load</button>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;

        // Add styles for conversation picker
        if (!document.getElementById('conversation-picker-styles')) {
            const styles = document.createElement('style');
            styles.id = 'conversation-picker-styles';
            styles.textContent = `
                .conversation-list {
                    max-height: 400px;
                    overflow-y: auto;
                }
                .conversation-item {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 12px;
                    border: 1px solid #e5e7eb;
                    border-radius: 8px;
                    margin-bottom: 8px;
                    transition: background-color 0.15s ease;
                }
                .conversation-item:hover {
                    background-color: #f9fafb;
                }
                .conversation-info {
                    flex: 1;
                }
                .conversation-date {
                    font-weight: 600;
                    color: #111827;
                    margin-bottom: 4px;
                }
                .conversation-details {
                    font-size: 0.875rem;
                    color: #6b7280;
                }
                .btn-sm {
                    padding: 6px 12px;
                    font-size: 0.875rem;
                }
            `;
            document.head.appendChild(styles);
        }

        document.body.appendChild(modal);

        // Event listeners
        modal.querySelector('.modal-close').addEventListener('click', () => {
            modal.remove();
        });

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });

        modal.querySelectorAll('.load-conversation-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const filename = e.target.closest('.conversation-item').dataset.filename;
                this.loadConversation(filename);
                modal.remove();
            });
        });
    }

    loadConversation(filename) {
        if (!this.socket) {
            utils.showToast('Not connected to server', 'error');
            return;
        }

        this.socket.emit('load_conversation', { filename });
    }

    loadConversationMessages(messages) {
        this.clearMessages();
        
        messages.forEach(msg => {
            if (msg.type === 'user' && msg.message.trim()) {
                this.addUserMessage(msg.message, msg.timestamp);
            } else if (msg.type === 'bot' && msg.message.trim()) {
                this.addBotMessage(msg.message, msg.timestamp);
            }
        });
    }
}

// Initialize chat interface when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.chatInterface = new ChatInterface();
    
    // Focus input after a short delay
    setTimeout(() => {
        const messageInput = document.getElementById('message-input');
        if (messageInput) {
            messageInput.focus();
        }
    }, 500);
});