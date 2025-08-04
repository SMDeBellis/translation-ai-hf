import React from 'react';
import { useAuthEffect } from '@/hooks/useAuthEffect';

/**
 * Component that handles authentication side effects
 * Must be rendered inside both AuthProvider and AppProvider
 */
const AuthEffectHandler: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  useAuthEffect();
  return <>{children}</>;
};

export default AuthEffectHandler;