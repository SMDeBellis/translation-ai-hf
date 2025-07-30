// Grammar Notes JavaScript for Spanish Tutor Web GUI

class GrammarNotesManager {
    constructor() {
        this.notesContent = '';
        this.originalContent = '';
        this.searchTerm = '';
        
        this.loadingElement = document.getElementById('notes-loading');
        this.emptyElement = document.getElementById('notes-empty');
        this.contentElement = document.getElementById('notes-content');
        this.notesTextElement = document.getElementById('notes-text');
        
        this.refreshBtn = document.getElementById('refresh-notes-btn');
        this.exportBtn = document.getElementById('export-notes-btn');
        this.clearBtn = document.getElementById('clear-notes-btn');
        
        this.searchInput = document.getElementById('search-notes');
        this.searchClear = document.getElementById('search-clear');
        
        this.wordCountElement = document.getElementById('notes-word-count');
        this.charCountElement = document.getElementById('notes-char-count');
        this.lastUpdatedElement = document.getElementById('notes-last-updated');
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadNotes();
    }

    setupEventListeners() {
        // Toolbar buttons
        this.refreshBtn.addEventListener('click', () => {
            this.loadNotes(true);
        });

        this.exportBtn.addEventListener('click', () => {
            this.exportNotes();
        });

        this.clearBtn.addEventListener('click', () => {
            this.showClearConfirmation();
        });

        // Search functionality
        this.searchInput.addEventListener('input', utils.debounce(() => {
            this.performSearch();
        }, 300));

        this.searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.clearSearch();
            }
        });

        this.searchClear.addEventListener('click', () => {
            this.clearSearch();
        });

        // Modal event listeners
        document.getElementById('confirm-clear-btn').addEventListener('click', () => {
            this.confirmClear();
        });

        document.getElementById('export-before-clear-btn').addEventListener('click', () => {
            this.exportNotes();
            setTimeout(() => this.confirmClear(), 500);
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            // Ctrl+F to focus search
            if ((e.ctrlKey || e.metaKey) && e.key === 'f' && !e.target.closest('input, textarea')) {
                e.preventDefault();
                this.searchInput.focus();
            }
            
            // Ctrl+E to export
            if ((e.ctrlKey || e.metaKey) && e.key === 'e' && !e.target.closest('input, textarea')) {
                e.preventDefault();
                if (!this.exportBtn.disabled) {
                    this.exportNotes();
                }
            }
        });
    }

    async loadNotes(showLoading = false) {
        if (showLoading) {
            this.showLoading();
        }

        try {
            const data = await api.getGrammarNotes();
            
            if (!data.exists || !data.content.trim()) {
                this.showEmpty();
                return;
            }

            this.notesContent = data.content;
            this.originalContent = data.content;
            this.renderNotes();
            this.updateStats();
            this.showContent();
            
        } catch (error) {
            console.error('Failed to load grammar notes:', error);
            utils.showToast('Failed to load grammar notes', 'error');
            this.showEmpty();
        }
    }

    showLoading() {
        this.loadingElement.style.display = 'flex';
        this.emptyElement.style.display = 'none';
        this.contentElement.style.display = 'none';
    }

    showEmpty() {
        this.loadingElement.style.display = 'none';
        this.emptyElement.style.display = 'flex';
        this.contentElement.style.display = 'none';
        
        // Disable action buttons
        this.exportBtn.disabled = true;
        this.clearBtn.disabled = true;
    }

    showContent() {
        this.loadingElement.style.display = 'none';
        this.emptyElement.style.display = 'none';
        this.contentElement.style.display = 'flex';
        
        // Enable action buttons
        this.exportBtn.disabled = false;
        this.clearBtn.disabled = false;
    }

    renderNotes() {
        if (!this.notesContent) {
            this.notesTextElement.innerHTML = '<p>No grammar notes available.</p>';
            return;
        }

        // Convert markdown-like formatting to HTML
        let html = this.formatNotesAsHTML(this.notesContent);
        
        // Apply search highlighting if there's a search term
        if (this.searchTerm) {
            html = this.highlightSearchTerm(html, this.searchTerm);
        }
        
        this.notesTextElement.innerHTML = html;
    }

    formatNotesAsHTML(content) {
        // Simple markdown-like formatting
        let html = utils.escapeHtml(content);
        
        // Headers (lines starting with # ## ### etc)
        html = html.replace(/^(#{1,6})\s+(.+)$/gm, (match, hashes, text) => {
            const level = hashes.length;
            return `<h${level}>${text}</h${level}>`;
        });
        
        // Bold text (**text** or __text__)
        html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        html = html.replace(/__(.+?)__/g, '<strong>$1</strong>');
        
        // Italic text (*text* or _text_)
        html = html.replace(/(?<!\*)\*([^*]+?)\*(?!\*)/g, '<em>$1</em>');
        html = html.replace(/(?<!_)_([^_]+?)_(?!_)/g, '<em>$1</em>');
        
        // Code blocks (```code```)
        html = html.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
        
        // Inline code (`code`)
        html = html.replace(/`([^`]+?)`/g, '<code>$1</code>');
        
        // Horizontal rules (--- or ***)
        html = html.replace(/^(---|\*{3,})$/gm, '<hr>');
        
        // Blockquotes (> text)
        html = html.replace(/^>\s+(.+)$/gm, '<blockquote>$1</blockquote>');
        
        // Lists (- item or * item or 1. item)
        html = html.replace(/^[\s]*[-*+]\s+(.+)$/gm, '<li>$1</li>');
        html = html.replace(/^[\s]*\d+\.\s+(.+)$/gm, '<li>$1</li>');
        
        // Wrap consecutive <li> elements in <ul>
        html = html.replace(/(<li>.*<\/li>)/gs, (match) => {
            const items = match.split('</li>').filter(item => item.includes('<li>')).map(item => item + '</li>');
            return '<ul>' + items.join('') + '</ul>';
        });
        
        // Convert line breaks to paragraphs
        const paragraphs = html.split(/\n\s*\n/).filter(p => p.trim());
        html = paragraphs.map(p => {
            p = p.trim();
            // Don't wrap if it's already a block element
            if (p.startsWith('<h') || p.startsWith('<ul') || p.startsWith('<pre') || 
                p.startsWith('<blockquote') || p.startsWith('<hr')) {
                return p;
            }
            return `<p>${p.replace(/\n/g, '<br>')}</p>`;
        }).join('');
        
        return html;
    }

    performSearch() {
        this.searchTerm = this.searchInput.value.trim();
        
        if (this.searchTerm) {
            this.searchClear.style.display = 'block';
        } else {
            this.searchClear.style.display = 'none';
        }
        
        this.renderNotes();
        
        // Scroll to first match if found
        if (this.searchTerm) {
            const firstMatch = this.notesTextElement.querySelector('.search-highlight');
            if (firstMatch) {
                firstMatch.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
    }

    highlightSearchTerm(html, searchTerm) {
        if (!searchTerm) return html;
        
        // Create a case-insensitive regex, but be careful not to match inside HTML tags
        const regex = new RegExp(`(${this.escapeRegex(searchTerm)})`, 'gi');
        
        // Split the HTML to avoid matching inside tags
        const parts = html.split(/(<[^>]*>)/);
        
        return parts.map(part => {
            // Only process text parts (not HTML tags)
            if (!part.startsWith('<')) {
                return part.replace(regex, '<span class="search-highlight">$1</span>');
            }
            return part;
        }).join('');
    }

    escapeRegex(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    clearSearch() {
        this.searchInput.value = '';
        this.searchTerm = '';
        this.searchClear.style.display = 'none';
        this.renderNotes();
        this.searchInput.blur();
    }

    updateStats() {
        if (!this.notesContent) {
            this.wordCountElement.textContent = '0 words';
            this.charCountElement.textContent = '0 characters';
            this.lastUpdatedElement.textContent = 'Never updated';
            return;
        }

        // Count words (split by whitespace and filter empty strings)
        const words = this.notesContent.trim().split(/\s+/).filter(word => word.length > 0);
        const wordCount = words.length;
        
        // Count characters (excluding whitespace)
        const charCount = this.notesContent.replace(/\s/g, '').length;
        
        this.wordCountElement.textContent = `${wordCount.toLocaleString()} word${wordCount !== 1 ? 's' : ''}`;
        this.charCountElement.textContent = `${charCount.toLocaleString()} character${charCount !== 1 ? 's' : ''}`;
        
        // For last updated, we'd need to get file stats from the server
        // For now, just show that it was loaded
        this.lastUpdatedElement.textContent = 'Recently loaded';
    }

    exportNotes() {
        if (!this.notesContent) {
            utils.showToast('No notes to export', 'warning');
            return;
        }

        const timestamp = new Date().toISOString().split('T')[0];
        const filename = `spanish_grammar_notes_${timestamp}.md`;
        
        // Add header to the export
        const exportContent = `# Spanish Grammar Notes\n\nExported on: ${new Date().toLocaleString()}\n\n---\n\n${this.notesContent}`;
        
        utils.downloadTextFile(exportContent, filename);
        utils.showToast('Grammar notes exported successfully', 'success');
    }

    showClearConfirmation() {
        document.getElementById('clear-confirmation-modal').style.display = 'flex';
    }

    async confirmClear() {
        try {
            // Since we don't have a clear API endpoint yet, we'll just show a message
            // In a real implementation, you'd call api.clearGrammarNotes()
            utils.showToast('Clear functionality not implemented yet', 'warning');
            
            // Close modal
            document.getElementById('clear-confirmation-modal').style.display = 'none';
            
            // In a real implementation, you'd refresh the notes after clearing
            // this.loadNotes(true);
        } catch (error) {
            console.error('Failed to clear grammar notes:', error);
            utils.showToast('Failed to clear grammar notes', 'error');
        }
    }
}

// Initialize grammar notes manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.grammarNotesManager = new GrammarNotesManager();
});