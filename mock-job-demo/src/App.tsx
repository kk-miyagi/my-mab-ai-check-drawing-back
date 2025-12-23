import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import { MemoryRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { UploadProvider } from './screen/utils/UploadContext';
import { derivePhase } from './screen/utils/persist';
import { StartScreen } from './screen/cheking-drawings/StartScreen';
import { ProcessingScreen } from './screen/utils/ProcessingScreen';
import { ResultScreen } from './screen/utils/ResultScreen';
import { CsvImageUploadScreen } from './screen/label-create/CsvImageUploadScreen';
import { HubScreen } from './screen/HubScreen';

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
        <Routes>
          <Route path="/" element={<Navigate to="/hub" replace />} />
          <Route path="/hub" element={<HubScreen />} />
          <Route path="/cheking-drawings" element={<StartScreen />} />
          <Route path="/processing" element={<ProcessingScreen />} />
          <Route path="/result" element={<ResultScreen />} />
          <Route path="/label-create" element={<CsvImageUploadScreen />} />
          <Route path="*" element={<Navigate to="/hub" replace />} />
        </Routes>
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
