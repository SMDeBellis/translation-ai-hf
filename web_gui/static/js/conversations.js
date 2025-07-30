// Conversations management JavaScript for Spanish Tutor Web GUI

class ConversationsManager {
    constructor() {
        this.conversations = [];
        this.currentConversation = null;
        
        this.loadingElement = document.getElementById('conversations-loading');
        this.emptyElement = document.getElementById('conversations-empty');
        this.gridElement = document.getElementById('conversations-grid');
        this.refreshBtn = document.getElementById('refresh-conversations-btn');
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadConversations();
    }

    setupEventListeners() {
        // Refresh button
        this.refreshBtn.addEventListener('click', () => {
            this.loadConversations(true);
        });

        // Modal event listeners
        document.getElementById('load-conversation-btn').addEventListener('click', () => {
            this.continueConversation();
        });

        document.getElementById('export-conversation-btn').addEventListener('click', () => {
            this.exportConversation();
        });

        document.getElementById('confirm-delete-btn').addEventListener('click', () => {
            this.confirmDelete();
        });
    }

    async loadConversations(showLoading = false) {
        if (showLoading) {
            this.showLoading();
        }

        try {
            const data = await api.getConversations();
            this.conversations = data.conversations;
            this.renderConversations();
        } catch (error) {
            console.error('Failed to load conversations:', error);
            utils.showToast('Failed to load conversations', 'error');
            this.showEmpty();
        }
    }

    showLoading() {
        this.loadingElement.style.display = 'flex';
        this.emptyElement.style.display = 'none';
        this.gridElement.style.display = 'none';
    }

    showEmpty() {
        this.loadingElement.style.display = 'none';
        this.emptyElement.style.display = 'flex';
        this.gridElement.style.display = 'none';
    }

    showGrid() {
        this.loadingElement.style.display = 'none';
        this.emptyElement.style.display = 'none';
        this.gridElement.style.display = 'grid';
    }

    renderConversations() {
        if (this.conversations.length === 0) {
            this.showEmpty();
            return;
        }

        this.showGrid();
        
        this.gridElement.innerHTML = this.conversations.map(conv => 
            this.createConversationCard(conv)
        ).join('');

        // Add event listeners to cards
        this.gridElement.querySelectorAll('.conversation-card').forEach(card => {
            const filename = card.dataset.filename;
            
            card.addEventListener('click', (e) => {
                // Don't trigger if clicking on action buttons
                if (!e.target.closest('.action-btn')) {
                    this.showConversationDetails(filename);
                }
            });
        });

        // Add event listeners to action buttons
        this.gridElement.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const filename = e.target.closest('.conversation-card').dataset.filename;
                this.deleteConversation(filename);
            });
        });

        this.gridElement.querySelectorAll('.export-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const filename = e.target.closest('.conversation-card').dataset.filename;
                this.quickExportConversation(filename);
            });
        });
    }

    createConversationCard(conversation) {
        const sessionDate = new Date(conversation.session_start);
        const filename = conversation.file.split('/').pop();
        
        // Get first exchange for preview
        const preview = this.getConversationPreview(conversation);
        
        return `
            <div class="conversation-card" data-filename="${utils.escapeHtml(filename)}">
                <div class="conversation-card-header">
                    <div>
                        <div class="conversation-date">
                            ${sessionDate.toLocaleDateString()}
                        </div>
                        <div class="conversation-time">
                            ${sessionDate.toLocaleTimeString()}
                        </div>
                    </div>
                    <div class="conversation-actions">
                        <button class="action-btn export-btn" title="Export Conversation">
                            📥
                        </button>
                        <button class="action-btn delete-btn danger" title="Delete Conversation">
                            🗑️
                        </button>
                    </div>
                </div>
                
                <div class="conversation-stats">
                    <div class="conversation-stat">
                        <span>💬</span>
                        <span>${conversation.exchanges} exchanges</span>
                    </div>
                    <div class="conversation-stat">
                        <span>🤖</span>
                        <span>${conversation.model}</span>
                    </div>
                    <div class="conversation-stat">
                        <span>📁</span>
                        <span>${Math.round(conversation.file_size / 1024)}KB</span>
                    </div>
                </div>
                
                ${preview ? `
                    <div class="conversation-preview">
                        ${utils.escapeHtml(preview)}
                    </div>
                ` : ''}
            </div>
        `;
    }

    getConversationPreview(conversation) {
        // Try to get preview from first user message
        // This would require loading the conversation file, so we'll skip for now
        // and just show a generic preview
        return `Conversation started ${utils.formatTimestamp(conversation.session_start)}`;
    }

    async showConversationDetails(filename) {
        try {
            const conversation = await api.getConversation(filename);
            this.currentConversation = { filename, data: conversation };
            
            this.renderConversationDetails(conversation);
            document.getElementById('conversation-detail-modal').style.display = 'flex';
        } catch (error) {
            console.error('Failed to load conversation details:', error);
            utils.showToast('Failed to load conversation details', 'error');
        }
    }

    renderConversationDetails(conversation) {
        const sessionDate = new Date(conversation.session_start);
        const title = `Conversation - ${sessionDate.toLocaleString()}`;
        
        document.getElementById('conversation-detail-title').textContent = title;
        
        const contentDiv = document.getElementById('conversation-detail-content');
        
        if (!conversation.conversation || conversation.conversation.length === 0) {
            contentDiv.innerHTML = `
                <div class="empty-state">
                    <p>This conversation has no messages.</p>
                </div>
            `;
            return;
        }

        const messagesHtml = conversation.conversation.map(exchange => {
            const timestamp = exchange.timestamp || conversation.session_start;
            const userMsg = exchange.user || '';
            const botMsg = exchange.bot || '';
            
            let html = '';
            
            if (userMsg.trim()) {
                html += `
                    <div class="detail-message user">
                        <div class="detail-message-content">${utils.escapeHtml(userMsg)}</div>
                        <div class="detail-message-time">${utils.formatDetailedTimestamp(timestamp)}</div>
                    </div>
                `;
            }
            
            if (botMsg.trim()) {
                html += `
                    <div class="detail-message bot">
                        <div class="detail-message-content">${utils.escapeHtml(botMsg)}</div>
                        <div class="detail-message-time">${utils.formatDetailedTimestamp(timestamp)}</div>
                    </div>
                `;
            }
            
            return html;
        }).join('');

        contentDiv.innerHTML = `
            <div class="conversation-detail-info">
                <div class="conversation-stats">
                    <div class="conversation-stat">
                        <span>📅</span>
                        <span>${sessionDate.toLocaleString()}</span>
                    </div>
                    <div class="conversation-stat">
                        <span>💬</span>
                        <span>${conversation.conversation.length} exchanges</span>
                    </div>
                    <div class="conversation-stat">
                        <span>🤖</span>
                        <span>${conversation.model}</span>
                    </div>
                </div>
            </div>
            <div class="conversation-detail-messages">
                ${messagesHtml}
            </div>
        `;
    }

    continueConversation() {
        if (!this.currentConversation) return;
        
        // Redirect to chat page with conversation to load
        const filename = this.currentConversation.filename;
        window.location.href = `/?load=${encodeURIComponent(filename)}`;
    }

    exportConversation() {
        if (!this.currentConversation) return;
        
        const data = this.currentConversation.data;
        const filename = this.currentConversation.filename.replace('.json', '.md');
        
        const markdown = this.convertToMarkdown(data);
        utils.downloadTextFile(markdown, filename);
        
        utils.showToast('Conversation exported successfully', 'success');
    }

    async quickExportConversation(filename) {
        try {
            const conversation = await api.getConversation(filename);
            const markdown = this.convertToMarkdown(conversation);
            const exportFilename = filename.replace('.json', '.md');
            
            utils.downloadTextFile(markdown, exportFilename);
            utils.showToast('Conversation exported successfully', 'success');
        } catch (error) {
            console.error('Failed to export conversation:', error);
            utils.showToast('Failed to export conversation', 'error');
        }
    }

    convertToMarkdown(conversation) {
        const sessionDate = new Date(conversation.session_start);
        
        let markdown = `# Spanish Tutor Conversation\n\n`;
        markdown += `**Date:** ${sessionDate.toLocaleString()}\n`;
        markdown += `**Model:** ${conversation.model}\n`;
        markdown += `**Exchanges:** ${conversation.conversation?.length || 0}\n\n`;
        markdown += `---\n\n`;

        if (conversation.conversation && conversation.conversation.length > 0) {
            conversation.conversation.forEach((exchange, index) => {
                const userMsg = exchange.user || '';
                const botMsg = exchange.bot || '';
                const timestamp = exchange.timestamp || conversation.session_start;
                const time = new Date(timestamp).toLocaleTimeString();

                if (userMsg.trim()) {
                    markdown += `## User (${time})\n\n${userMsg}\n\n`;
                }
                
                if (botMsg.trim()) {
                    markdown += `## Tutor (${time})\n\n${botMsg}\n\n`;
                }
                
                if (index < conversation.conversation.length - 1) {
                    markdown += `---\n\n`;
                }
            });
        }

        markdown += `\n---\n\n*Exported from Spanish Tutor Web GUI*\n`;
        
        return markdown;
    }

    deleteConversation(filename) {
        const conv = this.conversations.find(c => c.file.endsWith(filename));
        if (!conv) return;

        const sessionDate = new Date(conv.session_start);
        
        // Show confirmation modal with details
        const confirmModal = document.getElementById('delete-confirmation-modal');
        const modalBody = confirmModal.querySelector('.modal-body');
        
        modalBody.innerHTML = `
            <p>Are you sure you want to delete this conversation?</p>
            <div class="conversation-detail-info">
                <strong>Date:</strong> ${sessionDate.toLocaleString()}<br>
                <strong>Exchanges:</strong> ${conv.exchanges}<br>
                <strong>Model:</strong> ${conv.model}
            </div>
            <p><strong>This action cannot be undone.</strong></p>
        `;
        
        // Store filename for deletion
        document.getElementById('confirm-delete-btn').dataset.filename = filename;
        
        confirmModal.style.display = 'flex';
    }

    async confirmDelete() {
        const filename = document.getElementById('confirm-delete-btn').dataset.filename;
        if (!filename) return;

        try {
            // Since we don't have a delete API endpoint yet, we'll just show a message
            // In a real implementation, you'd call api.deleteConversation(filename)
            utils.showToast('Delete functionality not implemented yet', 'warning');
            
            // Close modal
            document.getElementById('delete-confirmation-modal').style.display = 'none';
            
            // Refresh conversations list
            // this.loadConversations(true);
        } catch (error) {
            console.error('Failed to delete conversation:', error);
            utils.showToast('Failed to delete conversation', 'error');
        }
    }
}

// Initialize conversations manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.conversationsManager = new ConversationsManager();
});

// Handle query parameters for loading specific conversations
document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const loadParam = urlParams.get('load');
    
    if (loadParam) {
        // If coming from chat page with a conversation to load
        setTimeout(() => {
            window.conversationsManager.showConversationDetails(loadParam);
        }, 1000);
    }
});