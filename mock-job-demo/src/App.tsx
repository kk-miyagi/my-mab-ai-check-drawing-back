import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import { UploadProvider } from './components/upload/UploadContext';
import { derivePhase } from './routers/persist';
import { AppRouter } from './routers/Router';

const PersistNavigator: React.FC = () => {
  const navigate = useNavigate();
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const nextPhase = derivePhase(window.localStorage.getItem('upload_state_v1'));
    if (nextPhase === 'issuing_id' || nextPhase === 'uploading' || nextPhase === 'verifying') {
      navigate('/processing', { replace: true });
    } else if (nextPhase === 'complete' || nextPhase === 'error') {
      navigate('/result', { replace: true });
    }
  }, [navigate]);
  return null;
};

export const App: React.FC = () => {
  const initialEntry = (() => {
    if (typeof window === 'undefined') return '/hub';
    const nextPhase = derivePhase(window.localStorage.getItem('upload_state_v1'));
    if (nextPhase === 'issuing_id' || nextPhase === 'uploading' || nextPhase === 'verifying') return '/processing';
    if (nextPhase === 'complete' || nextPhase === 'error') return '/result';
    return '/hub';
  })();

  return (
    <MemoryRouter initialEntries={[initialEntry]}>
      <UploadProvider>
        <PersistNavigator />
        <AppRouter />
      </UploadProvider>
    </MemoryRouter>
  );
};

export default App;

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element #root not found');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
