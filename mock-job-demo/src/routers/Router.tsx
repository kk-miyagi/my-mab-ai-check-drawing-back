import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { StartScreen } from '../features/cheking_drawings/StartScreen';
import { ProcessingScreen } from '../components/upload/ProcessingScreen';
import { ResultScreen } from '../components/upload/ResultScreen';
import { CsvImageUploadScreen } from '../features/label_create/CsvImageUploadScreen';
import { CreateLabelScreen } from '../features/label_create/CreateLabelScreen';
import { HubScreen } from '../pages/HubScreen';
import { useEffect } from 'react';
import { derivePhase } from './persist';
import { CreateLabelProcessingScreen } from '../features/label_create/CreateLabelProcessingScreen';
import { CreateLabelResultScreen } from '../features/label_create/CreateLabelResult';

export const AppRouter = () => {
  // const navigate = useNavigate();
  // useEffect(() => {
  //   if (typeof window === 'undefined') return;
  //   const nextPhase = derivePhase(window.localStorage.getItem('upload_state_v1'));
  //   if (nextPhase === 'issuing_id' || nextPhase === 'uploading' || nextPhase === 'verifying') {
  //     navigate('/processing', { replace: true });
  //   } else if (nextPhase === 'complete' || nextPhase === 'error') {
  //     navigate('/result', { replace: true });
  //   }
  // }, [navigate]);

  return (
    <Routes>
      <Route path="/" element={<Navigate to="/hub" replace />} />
      <Route path="/hub" element={<HubScreen />} />
      <Route path="/cheking-drawings" element={<StartScreen />} />
      <Route path="/processing" element={<ProcessingScreen />} />
      <Route path="/result" element={<ResultScreen />} />
      <Route path="/label-create" element={<CsvImageUploadScreen />} />
      <Route path="/create-label" element={<CreateLabelScreen />} />
      <Route path="/label-create-processing" element={<CreateLabelProcessingScreen />} />
      <Route path="/label-create-result" element={<CreateLabelResultScreen />} />
      <Route path="*" element={<Navigate to="/hub" replace />} />
    </Routes>
  )
};
