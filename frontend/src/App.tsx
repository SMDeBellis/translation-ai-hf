import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AppProvider } from '@/context/AppContext';
import Layout from '@/components/Layout';
import ChatPage from '@/pages/ChatPage';
import ConversationsPage from '@/pages/ConversationsPage';
import GrammarNotesPage from '@/pages/GrammarNotesPage';
import SettingsPage from '@/pages/SettingsPage';
import '@/styles/index.css';

const App: React.FC = () => {
  return (
    <AppProvider>
      <Router>
        <Layout>
          <Routes>
            <Route path="/" element={<ChatPage />} />
            <Route path="/conversations" element={<ConversationsPage />} />
            <Route path="/grammar-notes" element={<GrammarNotesPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </Layout>
      </Router>
    </AppProvider>
  );
};

export default App;