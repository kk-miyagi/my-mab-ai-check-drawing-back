import React from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { AppRouter } from './routers/Router';
import {
  CssBaseline,
  ThemeProvider
} from '@mui/material';
import { theme } from './styles/theme';

export const App: React.FC = () => {

  return (
    <MemoryRouter initialEntries={['/']}>
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
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <App />
    </ThemeProvider>
  </React.StrictMode>
);
