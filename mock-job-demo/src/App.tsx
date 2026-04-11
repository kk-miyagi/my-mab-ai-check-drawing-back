import React from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { getRedirectUrl } from './routers/getRedirectUrl';
import { AppRouter } from './routers/Router';
import './index.css';

export const App: React.FC = () => {
  const initialEntry = (() => {
    if (typeof window === 'undefined') return '/hub';

    // MemoryRouter はブラウザURLを自動で拾わないため、直アクセス時は現在URLを優先する。
    const browserPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (browserPath && browserPath !== '/') return browserPath;

    const return_screen = getRedirectUrl();
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
