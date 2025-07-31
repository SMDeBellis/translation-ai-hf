import React, { useEffect, useState } from 'react';
import { useSocket } from '@/hooks/useSocket';
import { useAppContext } from '@/context/AppContext';

const ConnectionStatus: React.FC = () => {
  const { on } = useSocket();
  const { setConnectionStatus } = useAppContext();
  const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');

  useEffect(() => {
    const cleanup = on('connection_status', (data) => {
      if (data.connected) {
        setStatus('connected');
        setConnectionStatus(true);
      } else {
        setStatus('disconnected');
        setConnectionStatus(false);
      }
    });

    return cleanup;
  }, [on, setConnectionStatus]);

  const getStatusClass = () => {
    switch (status) {
      case 'connected':
        return 'status-indicator connected';
      case 'disconnected':
        return 'status-indicator disconnected';
      default:
        return 'status-indicator connecting';
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'connected':
        return 'Connected';
      case 'disconnected':
        return 'Disconnected';
      default:
        return 'Connecting...';
    }
  };

  return (
    <div id="connection-status" className={getStatusClass()}>
      <span className="status-dot"></span>
      <span className="status-text">{getStatusText()}</span>
    </div>
  );
};

export default ConnectionStatus;