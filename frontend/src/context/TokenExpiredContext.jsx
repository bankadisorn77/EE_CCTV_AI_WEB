import { createContext, useContext, useState, useCallback } from 'react';

const TokenExpiredContext = createContext(null);

export function useTokenExpired() {
  const ctx = useContext(TokenExpiredContext);
  if (!ctx) throw new Error('useTokenExpired must be used inside <TokenExpiredProvider>');
  return ctx;
}

export function TokenExpiredProvider({ children }) {
  const [isOpen, setIsOpen] = useState(false);
  const [timeUntilLogout, setTimeUntilLogout] = useState(60); // 60 วินาที

  const showDialog = useCallback(() => {
    setIsOpen(true);
    setTimeUntilLogout(60); // Reset timer
  }, []);

  const closeDialog = useCallback(() => {
    setIsOpen(false);
  }, []);

  return (
    <TokenExpiredContext.Provider value={{ isOpen, showDialog, closeDialog, timeUntilLogout, setTimeUntilLogout }}>
      {children}
    </TokenExpiredContext.Provider>
  );
}
