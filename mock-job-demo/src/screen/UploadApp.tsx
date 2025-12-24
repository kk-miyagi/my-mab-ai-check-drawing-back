import React from 'react';
import { MemoryRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { UploadProvider } from './utils/UploadContext';
import { derivePhase } from './utils/persist';
import { StartScreen, ProcessingScreen, ResultScreen, CsvImageUploadScreen, HubScreen } from './Screens';

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

const UploadApp: React.FC = () => {
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

export default UploadApp;
