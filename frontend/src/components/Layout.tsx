import React, { ReactNode } from 'react';
import Navigation from './Navigation';
import Footer from './Footer';
import KeyboardShortcutsModal from './KeyboardShortcutsModal';
import AboutModal from './AboutModal';

interface LayoutProps {
  children: ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <>
      <Navigation />
      <main className="main-content">
        {children}
      </main>
      <Footer />
      <KeyboardShortcutsModal />
      <AboutModal />
    </>
  );
};

export default Layout;