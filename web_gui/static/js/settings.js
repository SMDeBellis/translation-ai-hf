// Settings JavaScript for Spanish Tutor Web GUI

class SettingsManager {
    constructor() {
        this.defaultSettings = {
            ollamaHost: 'localhost:11434',
            model: 'llama3',
            connectionTimeout: 30,
            theme: 'light',
            fontSize: 16,
            autoScroll: true,
            showTimestamps: true,
            autoSaveConversations: true,
            autoSaveGrammar: true,
            maxConversationHistory: 100,
            debugMode: false,
            experimentalFeatures: false
        };
        
        this.currentSettings = { ...this.defaultSettings };
        this.hasUnsavedChanges = false;
        
        this.form = document.getElementById('settings-form');
        this.testConnectionBtn = document.getElementById('test-connection-btn');
        this.resetSettingsBtn = document.getElementById('reset-settings-btn');
        this.saveBtn = document.getElementById('save-btn');
        this.cancelBtn = document.getElementById('cancel-btn');
        
        this.init();
    }

    init() {
        this.loadSettings();
        this.setupEventListeners();
        this.updateFontSizeDisplay();
    }

    setupEventListeners() {
        // Form submission
        this.form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveSettings();
        });

        // Button events
        this.testConnectionBtn.addEventListener('click', () => {
            this.testConnection();
        });

        this.resetSettingsBtn.addEventListener('click', () => {
            this.resetToDefaults();
        });

        this.cancelBtn.addEventListener('click', () => {
            this.cancelChanges();
        });

        // Form change detection
        this.form.addEventListener('input', () => {
            this.markAsChanged();
        });

        this.form.addEventListener('change', () => {
            this.markAsChanged();
        });

        // Font size range slider
        const fontSizeSlider = document.getElementById('font-size');
        fontSizeSlider.addEventListener('input', () => {
            this.updateFontSizeDisplay();
        });

        // Prevent navigation with unsaved changes
        window.addEventListener('beforeunload', (e) => {
            if (this.hasUnsavedChanges) {
                e.preventDefault();
                e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
                return e.returnValue;
            }
        });

        // Navigation warning for internal links
        document.addEventListener('click', (e) => {
            const link = e.target.closest('a[href]');
            if (link && this.hasUnsavedChanges && !link.href.startsWith('http')) {
                if (!confirm('You have unsaved changes. Are you sure you want to leave this page?')) {
                    e.preventDefault();
                }
            }
        });
    }

    loadSettings() {
        // Load settings from localStorage
        const savedSettings = localStorage.getItem('spanishTutorSettings');
        if (savedSettings) {
            try {
                this.currentSettings = { ...this.defaultSettings, ...JSON.parse(savedSettings) };
            } catch (error) {
                console.error('Failed to load settings:', error);
                this.currentSettings = { ...this.defaultSettings };
            }
        }

        this.populateForm();
    }

    populateForm() {
        // Populate form fields with current settings
        document.getElementById('ollama-host').value = this.currentSettings.ollamaHost;
        document.getElementById('model-select').value = this.currentSettings.model;
        document.getElementById('connection-timeout').value = this.currentSettings.connectionTimeout;
        document.getElementById('theme-select').value = this.currentSettings.theme;
        document.getElementById('font-size').value = this.currentSettings.fontSize;
        document.getElementById('auto-scroll').checked = this.currentSettings.autoScroll;
        document.getElementById('show-timestamps').checked = this.currentSettings.showTimestamps;
        document.getElementById('auto-save-conversations').checked = this.currentSettings.autoSaveConversations;
        document.getElementById('auto-save-grammar').checked = this.currentSettings.autoSaveGrammar;
        document.getElementById('max-conversation-history').value = this.currentSettings.maxConversationHistory;
        document.getElementById('debug-mode').checked = this.currentSettings.debugMode;
        document.getElementById('experimental-features').checked = this.currentSettings.experimentalFeatures;

        this.updateFontSizeDisplay();
    }

    getFormData() {
        const formData = new FormData(this.form);
        const settings = {};

        // Get all form values
        settings.ollamaHost = formData.get('ollamaHost');
        settings.model = formData.get('model');
        settings.connectionTimeout = parseInt(formData.get('connectionTimeout'));
        settings.theme = formData.get('theme');
        settings.fontSize = parseInt(formData.get('fontSize'));
        settings.autoScroll = formData.has('autoScroll');
        settings.showTimestamps = formData.has('showTimestamps');
        settings.autoSaveConversations = formData.has('autoSaveConversations');
        settings.autoSaveGrammar = formData.has('autoSaveGrammar');
        settings.maxConversationHistory = parseInt(formData.get('maxConversationHistory'));
        settings.debugMode = formData.has('debugMode');
        settings.experimentalFeatures = formData.has('experimentalFeatures');

        return settings;
    }

    markAsChanged() {
        if (!this.hasUnsavedChanges) {
            this.hasUnsavedChanges = true;
            this.showChangedBanner();
        }
    }

    showChangedBanner() {
        // Create or show the unsaved changes banner
        let banner = document.getElementById('settings-changed-banner');
        if (!banner) {
            banner = document.createElement('div');
            banner.id = 'settings-changed-banner';
            banner.className = 'settings-changed-banner';
            banner.innerHTML = `
                <span>⚠️</span>
                <span>You have unsaved changes</span>
                <button onclick="window.settingsManager.saveSettings()" class="btn btn-secondary btn-sm">Save</button>
                <button onclick="window.settingsManager.cancelChanges()" class="btn btn-secondary btn-sm">Cancel</button>
            `;
            document.body.appendChild(banner);
        }
        banner.classList.add('show');
    }

    hideChangedBanner() {
        const banner = document.getElementById('settings-changed-banner');
        if (banner) {
            banner.classList.remove('show');
        }
    }

    saveSettings() {
        const newSettings = this.getFormData();
        
        // Validate settings
        if (!this.validateSettings(newSettings)) {
            return;
        }

        // Save to localStorage
        try {
            localStorage.setItem('spanishTutorSettings', JSON.stringify(newSettings));
            this.currentSettings = newSettings;
            this.hasUnsavedChanges = false;
            this.hideChangedBanner();
            
            // Apply settings immediately
            this.applySettings();
            
            utils.showToast('Settings saved successfully', 'success');
        } catch (error) {
            console.error('Failed to save settings:', error);
            utils.showToast('Failed to save settings', 'error');
        }
    }

    validateSettings(settings) {
        // Validate Ollama host
        if (!settings.ollamaHost || !settings.ollamaHost.trim()) {
            utils.showToast('Ollama host cannot be empty', 'error');
            document.getElementById('ollama-host').focus();
            return false;
        }

        // Validate timeout
        if (settings.connectionTimeout < 5 || settings.connectionTimeout > 120) {
            utils.showToast('Connection timeout must be between 5 and 120 seconds', 'error');
            document.getElementById('connection-timeout').focus();
            return false;
        }

        // Validate font size
        if (settings.fontSize < 12 || settings.fontSize > 20) {
            utils.showToast('Font size must be between 12 and 20 pixels', 'error');
            document.getElementById('font-size').focus();
            return false;
        }

        // Validate max conversation history
        if (settings.maxConversationHistory < 10 || settings.maxConversationHistory > 1000) {
            utils.showToast('Max conversation history must be between 10 and 1000', 'error');
            document.getElementById('max-conversation-history').focus();
            return false;
        }

        return true;
    }

    applySettings() {
        // Apply settings to the current page
        const settings = this.currentSettings;

        // Update global settings
        if (window.SpanishTutor) {
            window.SpanishTutor.settings = settings;
        }

        // Apply font size
        document.documentElement.style.setProperty('--base-font-size', `${settings.fontSize}px`);

        // Apply theme (when dark theme is implemented)
        if (settings.theme === 'dark') {
            document.body.classList.add('dark-theme');
        } else {
            document.body.classList.remove('dark-theme');
        }

        // Apply debug mode
        if (settings.debugMode) {
            console.log('Debug mode enabled');
            window.debugMode = true;
        } else {
            window.debugMode = false;
        }
    }

    cancelChanges() {
        if (this.hasUnsavedChanges) {
            if (confirm('Are you sure you want to discard your changes?')) {
                this.populateForm();
                this.hasUnsavedChanges = false;
                this.hideChangedBanner();
                utils.showToast('Changes discarded', 'info');
            }
        }
    }

    resetToDefaults() {
        if (confirm('Are you sure you want to reset all settings to their default values?')) {
            this.currentSettings = { ...this.defaultSettings };
            this.populateForm();
            this.hasUnsavedChanges = true;
            this.showChangedBanner();
            utils.showToast('Settings reset to defaults. Click Save to apply.', 'info');
        }
    }

    updateFontSizeDisplay() {
        const slider = document.getElementById('font-size');
        const display = document.getElementById('font-size-value');
        display.textContent = `${slider.value}px`;
    }

    async testConnection() {
        const modal = document.getElementById('connection-test-modal');
        const content = document.getElementById('connection-test-content');
        
        modal.style.display = 'flex';
        
        // Show loading state
        content.innerHTML = `
            <div class="loading-state">
                <div class="spinner"></div>
                <p>Testing connection to Ollama...</p>
            </div>
        `;

        try {
            // Get current host setting
            const host = document.getElementById('ollama-host').value;
            
            // Test connection
            const response = await fetch(`/api/ollama/status`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            const data = await response.json();

            if (data.connected) {
                content.innerHTML = `
                    <div class="connection-status success">
                        <span>✅</span>
                        <div>
                            <strong>Connection Successful</strong>
                            <p>Successfully connected to Ollama at ${data.host}</p>
                            <small>Tested at ${utils.formatDetailedTimestamp(data.timestamp)}</small>
                        </div>
                    </div>
                `;
            } else {
                content.innerHTML = `
                    <div class="connection-status error">
                        <span>❌</span>
                        <div>
                            <strong>Connection Failed</strong>
                            <p>Could not connect to Ollama server</p>
                            <small>Make sure Ollama is running and accessible</small>
                        </div>
                    </div>
                `;
            }
        } catch (error) {
            console.error('Connection test failed:', error);
            content.innerHTML = `
                <div class="connection-status error">
                    <span>❌</span>
                    <div>
                        <strong>Connection Error</strong>
                        <p>Failed to test connection: ${error.message}</p>
                        <small>Check your network connection and Ollama server</small>
                    </div>
                </div>
            `;
        }
    }

    // Public method to get current settings
    getSettings() {
        return { ...this.currentSettings };
    }

    // Public method to update a specific setting
    updateSetting(key, value) {
        if (key in this.currentSettings) {
            this.currentSettings[key] = value;
            this.populateForm();
            this.markAsChanged();
        }
    }
}

// Initialize settings manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.settingsManager = new SettingsManager();
});

// Apply saved settings on page load
document.addEventListener('DOMContentLoaded', () => {
    // Apply any saved settings immediately
    const savedSettings = localStorage.getItem('spanishTutorSettings');
    if (savedSettings) {
        try {
            const settings = JSON.parse(savedSettings);
            
            // Apply font size
            if (settings.fontSize) {
                document.documentElement.style.setProperty('--base-font-size', `${settings.fontSize}px`);
            }
            
            // Apply theme
            if (settings.theme === 'dark') {
                document.body.classList.add('dark-theme');
            }
            
            // Apply debug mode
            if (settings.debugMode) {
                window.debugMode = true;
            }
            
        } catch (error) {
            console.error('Failed to apply saved settings:', error);
        }
    }
});