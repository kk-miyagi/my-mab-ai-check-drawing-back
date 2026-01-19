import React from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { getRedirectUrl } from './routers/getRedirectUrl';
import { AppRouter } from './routers/Router';
import { localStorageKey } from './constants/localStorageKey';
import './index.css';

export const App: React.FC = () => {
  const initialEntry = (() => {
    if (typeof window === 'undefined') return '/hub';
    const return_screen = getRedirectUrl(window.localStorage.getItem(localStorageKey.default));
    if (return_screen) return return_screen;
    return '/hub';
  })();

  return (
    <MemoryRouter initialEntries={[initialEntry]}>
      <AppRouter />
    </MemoryRouter>
  );
};

export default App;

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element #root not found');
}

createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
