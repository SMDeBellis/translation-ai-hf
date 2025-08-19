// Common JavaScript utilities for Spanish Tutor Web GUI

// Global state
window.SpanishTutor = {
    socket: null,
    isConnected: false,
    currentPage: window.location.pathname,
    settings: {
        ollamaHost: 'localhost:11434',
        model: 'llama3'
    }
};

// Utility functions
const utils = {
    // Format timestamp for display
    formatTimestamp(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) {
            return 'Just now';
        } else if (diffMins < 60) {
            return `${diffMins}m ago`;
        } else if (diffHours < 24) {
            return `${diffHours}h ago`;
        } else if (diffDays < 7) {
            return `${diffDays}d ago`;
        } else {
            return date.toLocaleDateString();
        }
    },

    // Format timestamp for detailed view
    formatDetailedTimestamp(timestamp) {
        const date = new Date(timestamp);
        return date.toLocaleString();
    },

    // Escape HTML to prevent XSS
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    // Show toast notification
    showToast(message, type = 'info', duration = 3000) {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `
            <div class="toast-content">
                <span class="toast-icon">${this.getToastIcon(type)}</span>
                <span class="toast-message">${this.escapeHtml(message)}</span>
                <button class="toast-close" onclick="this.parentElement.parentElement.remove()">&times;</button>
            </div>
        `;

        // Add toast styles if not present
        if (!document.getElementById('toast-styles')) {
            const styles = document.createElement('style');
            styles.id = 'toast-styles';
            styles.textContent = `
                .toast {
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    z-index: 1000;
                    min-width: 300px;
                    max-width: 500px;
                    background: white;
                    border-radius: 8px;
                    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
                    border-left: 4px solid;
                    animation: toastSlideIn 0.3s ease-out;
                }
                .toast-info { border-left-color: #3b82f6; }
                .toast-success { border-left-color: #10b981; }
                .toast-warning { border-left-color: #f59e0b; }
                .toast-error { border-left-color: #ef4444; }
                .toast-content {
                    display: flex;
                    align-items: center;
                    padding: 16px;
                    gap: 12px;
                }
                .toast-icon {
                    font-size: 20px;
                    flex-shrink: 0;
                }
                .toast-message {
                    flex: 1;
                    font-size: 14px;
                    line-height: 1.4;
                }
                .toast-close {
                    background: none;
                    border: none;
                    font-size: 18px;
                    cursor: pointer;
                    color: #6b7280;
                    padding: 0;
                    width: 20px;
                    height: 20px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: 4px;
                    transition: background-color 0.15s ease;
                }
                .toast-close:hover {
                    background-color: #f3f4f6;
                }
                @keyframes toastSlideIn {
                    from {
                        transform: translateX(100%);
                        opacity: 0;
                    }
                    to {
                        transform: translateX(0);
                        opacity: 1;
                    }
                }
            `;
            document.head.appendChild(styles);
        }

        document.body.appendChild(toast);

        // Auto remove after duration
        if (duration > 0) {
            setTimeout(() => {
                if (toast.parentElement) {
                    toast.style.animation = 'toastSlideIn 0.3s ease-out reverse';
                    setTimeout(() => toast.remove(), 300);
                }
            }, duration);
        }
    },

    getToastIcon(type) {
        const icons = {
            info: 'ℹ️',
            success: '✅',
            warning: '⚠️',
            error: '❌'
        };
        return icons[type] || icons.info;
    },

    // Copy text to clipboard
    async copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            this.showToast('Copied to clipboard', 'success', 2000);
        } catch (err) {
            console.error('Failed to copy to clipboard:', err);
            this.showToast('Failed to copy to clipboard', 'error');
        }
    },

    // Download text as file
    downloadTextFile(content, filename) {
        const blob = new Blob([content], { type: 'text/plain' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    },

    // Debounce function
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    // Throttle function
    throttle(func, limit) {
        let inThrottle;
        return function executedFunction(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }
};

// Connection status management
const connectionStatus = {
    updateStatus(isConnected, message = '') {
        const statusElement = document.getElementById('connection-status');
        if (!statusElement) return;

        const statusDot = statusElement.querySelector('.status-dot');
        const statusText = statusElement.querySelector('.status-text');

        statusElement.className = 'status-indicator';
        
        if (isConnected) {
            statusElement.classList.add('connected');
            statusText.textContent = 'Connected';
        } else {
            statusElement.classList.add('disconnected');
            statusText.textContent = message || 'Disconnected';
        }

        window.SpanishTutor.isConnected = isConnected;
    },

    setConnecting() {
        const statusElement = document.getElementById('connection-status');
        if (!statusElement) return;

        const statusText = statusElement.querySelector('.status-text');
        statusElement.className = 'status-indicator connecting';
        statusText.textContent = 'Connecting...';
    }
};

// Socket.IO connection management
const socketManager = {
    connect() {
        if (window.SpanishTutor.socket) {
            return window.SpanishTutor.socket;
        }

        connectionStatus.setConnecting();

        const socket = io({
            transports: ['websocket', 'polling'],
            timeout: 20000,
            forceNew: true
        });

        // Connection events
        socket.on('connect', () => {
            console.log('Connected to server');
            connectionStatus.updateStatus(true);
            window.SpanishTutor.socket = socket;
        });

        socket.on('disconnect', (reason) => {
            console.log('Disconnected from server:', reason);
            connectionStatus.updateStatus(false, 'Disconnected');
            window.SpanishTutor.socket = null;
        });

        socket.on('connect_error', (error) => {
            console.error('Connection error:', error);
            connectionStatus.updateStatus(false, 'Connection Error');
            utils.showToast('Failed to connect to server', 'error');
        });

        // Common event handlers
        socket.on('error', (data) => {
            console.error('Server error:', data);
            utils.showToast(data.message || 'Server error occurred', 'error');
        });

        socket.on('system_message', (data) => {
            console.log('System message:', data.message);
            if (window.chatInterface) {
                window.chatInterface.addSystemMessage(data.message, data.timestamp);
            }
        });

        return socket;
    },

    disconnect() {
        if (window.SpanishTutor.socket) {
            window.SpanishTutor.socket.disconnect();
            window.SpanishTutor.socket = null;
        }
        connectionStatus.updateStatus(false);
    }
};

// API utilities
const api = {
    async request(endpoint, options = {}) {
        const url = `/api${endpoint}`;
        const config = {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        };

        try {
            const response = await fetch(url, config);
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || `HTTP ${response.status}`);
            }

            return data;
        } catch (error) {
            console.error(`API request failed: ${endpoint}`, error);
            throw error;
        }
    },

    // Health check
    async checkHealth() {
        return this.request('/health');
    },

    // Ollama status
    async checkOllamaStatus() {
        return this.request('/ollama/status');
    },

    // Conversations
    async getConversations() {
        return this.request('/conversations/list');
    },

    async getConversation(filename) {
        return this.request(`/conversations/${encodeURIComponent(filename)}`);
    },

};

// Global keyboard shortcuts
document.addEventListener('keydown', (e) => {
    // Don't trigger shortcuts when typing in inputs
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        return;
    }

    // Ctrl+/ - Show keyboard shortcuts
    if (e.ctrlKey && e.key === '/') {
        e.preventDefault();
        if (typeof showKeyboardShortcuts === 'function') {
            showKeyboardShortcuts();
        }
    }

    // Escape - Focus main input if available
    if (e.key === 'Escape') {
        const messageInput = document.getElementById('message-input');
        if (messageInput) {
            messageInput.focus();
        }
    }
});

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('Spanish Tutor Web GUI loaded');
    
    // Initialize socket connection for chat pages
    if (window.location.pathname === '/') {
        socketManager.connect();
    }
});

// Export utilities to global scope
window.utils = utils;
window.connectionStatus = connectionStatus;
window.socketManager = socketManager;
window.api = api;