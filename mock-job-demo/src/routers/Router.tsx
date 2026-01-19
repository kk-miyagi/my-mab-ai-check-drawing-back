import { Routes, Route, Navigate } from 'react-router-dom';
import { StartScreen } from '../features/cheking_drawings/StartScreen';
import { ProcessingScreen } from '../components/upload/ProcessingScreen';
import { ResultScreen } from '../components/upload/ResultScreen';
import { CsvImageUploadScreen } from '../features/label_create/CsvImageUploadScreen';
import { CreateLabelScreen } from '../features/label_create/CreateLabelScreen';
import { HubScreen } from '../pages/HubScreen';
import { CreateLabelProcessingScreen } from '../features/label_create/CreateLabelProcessingScreen';
import { CreateLabelResultScreen } from '../features/label_create/CreateLabelResult';

export const AppRouter = () => {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/hub" replace />} />
      <Route path="/hub" element={<HubScreen />} />
      <Route path="/cheking-drawings" element={<StartScreen />} />
      <Route path="/processing" element={<ProcessingScreen />} />
      <Route path="/result" element={<ResultScreen />} />
      <Route path="/label-create" element={<CsvImageUploadScreen />} />
      <Route path="/create-label" element={<CreateLabelScreen />} />
      <Route path="/create-label-processing" element={<CreateLabelProcessingScreen />} />
      <Route path="/create-label-result" element={<CreateLabelResultScreen />} />
      <Route path="*" element={<Navigate to="/hub" replace />} />
    </Routes>
  )
};
