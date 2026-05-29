import React from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { AppRouter } from './routers/Router';
import { AuthProvider } from './components/AuthContext';
import {
  CssBaseline,
  ThemeProvider
} from '@mui/material';
import { theme } from './styles/theme';
import { useAxiosInterceptor } from './hooks/useAxiosInterceptor';

const AxiosInterceptorSetup = () => {
  useAxiosInterceptor();
  return null;
};

export const App: React.FC = () => {

  return (
    <MemoryRouter initialEntries={['/']}>
      <AxiosInterceptorSetup />
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
      <AuthProvider>
        <App />
      </AuthProvider>
    </ThemeProvider>
  </React.StrictMode>
);
