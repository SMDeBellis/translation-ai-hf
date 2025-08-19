import React, { useState, useEffect } from 'react';
import { useAppContext } from '@/context/AppContext';
import { apiService } from '@/services/api';
import { showToast } from '@/utils';

const SettingsPage: React.FC = () => {
  const { settings, updateSettings } = useAppContext();
  const [ollamaStatus, setOllamaStatus] = useState<{
    connected: boolean;
    host?: string;
    error?: string;
  } | null>(null);
  const [isTestingConnection, setIsTestingConnection] = useState(false);

  const handleSettingChange = (key: keyof typeof settings, value: string) => {
    updateSettings({ [key]: value });
  };

  const testOllamaConnection = async () => {
    setIsTestingConnection(true);
    try {
      const response = await apiService.getOllamaStatus();
      
      if (response.error) {
        setOllamaStatus({
          connected: false,
          error: response.error,
        });
        showToast('Failed to connect to Ollama', 'error');
      } else if (response.data) {
        setOllamaStatus({
          connected: response.data.connected,
          host: response.data.host,
          error: response.data.error,
        });
        
        if (response.data.connected) {
          showToast('Successfully connected to Ollama', 'success');
        } else {
          showToast('Failed to connect to Ollama', 'error');
        }
      }
    } catch (err) {
      console.error('Failed to test Ollama connection:', err);
      setOllamaStatus({
        connected: false,
        error: 'Network error',
      });
      showToast('Network error while testing connection', 'error');
    } finally {
      setIsTestingConnection(false);
    }
  };

  useEffect(() => {
    // Test connection on component mount
    testOllamaConnection();
  }, []);

  const handleSaveSettings = () => {
    showToast('Settings saved successfully', 'success');
  };

  const handleResetSettings = () => {
    const confirmed = window.confirm('Reset all settings to default values?');
    if (confirmed) {
      updateSettings({
        ollamaHost: 'localhost:11434',
        model: 'llama3',
        theme: 'light',
      });
      showToast('Settings reset to defaults', 'info');
    }
  };

  return (
    <div className="settings-container">
      <div className="settings-header">
        <h1>Settings</h1>
        <p>Configure your Spanish Tutor experience</p>
      </div>

      <div className="settings-content">
        {/* Ollama Configuration */}
        <div className="settings-section">
          <h2>Ollama Configuration</h2>
          <p>Configure connection to your Ollama server</p>

          <div className="setting-group">
            <label htmlFor="ollama-host">Ollama Host</label>
            <input
              id="ollama-host"
              type="text"
              value={settings.ollamaHost}
              onChange={(e) => handleSettingChange('ollamaHost', e.target.value)}
              placeholder="localhost:11434"
              className="setting-input"
            />
            <small className="setting-help">
              The host and port where your Ollama server is running
            </small>
          </div>

          <div className="setting-group">
            <label htmlFor="model">Model</label>
            <select
              id="model"
              value={settings.model}
              onChange={(e) => handleSettingChange('model', e.target.value)}
              className="setting-select"
            >
              <option value="llama3">Llama 3</option>
              <option value="llama2">Llama 2</option>
              <option value="mistral">Mistral</option>
              <option value="codellama">Code Llama</option>
            </select>
            <small className="setting-help">
              The AI model to use for Spanish tutoring
            </small>
          </div>

          <div className="connection-test">
            <button
              className="btn btn-secondary"
              onClick={testOllamaConnection}
              disabled={isTestingConnection}
            >
              {isTestingConnection ? 'Testing...' : 'Test Connection'}
            </button>
            
            {ollamaStatus && (
              <div className={`connection-status ${ollamaStatus.connected ? 'connected' : 'disconnected'}`}>
                <span className="status-dot"></span>
                <span className="status-text">
                  {ollamaStatus.connected 
                    ? `Connected to ${ollamaStatus.host}`
                    : `Disconnected${ollamaStatus.error ? `: ${ollamaStatus.error}` : ''}`
                  }
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Appearance */}
        <div className="settings-section">
          <h2>Appearance</h2>
          <p>Customize the look and feel</p>

          <div className="setting-group">
            <label htmlFor="theme">Theme</label>
            <select
              id="theme"
              value={settings.theme}
              onChange={(e) => handleSettingChange('theme', e.target.value as 'light' | 'dark')}
              className="setting-select"
            >
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
            <small className="setting-help">
              Choose your preferred color scheme
            </small>
          </div>
        </div>

        {/* Data Management */}
        <div className="settings-section">
          <h2>Data Management</h2>
          <p>Manage your conversations and data</p>

          <div className="setting-actions">
            <button className="btn btn-secondary">
              📥 Export All Data
            </button>
            <button className="btn btn-warning">
              🗑️ Clear All Conversations
            </button>
          </div>
        </div>

        {/* Settings Actions */}
        <div className="settings-actions">
          <button
            className="btn btn-primary"
            onClick={handleSaveSettings}
          >
            Save Settings
          </button>
          <button
            className="btn btn-secondary"
            onClick={handleResetSettings}
          >
            Reset to Defaults
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;