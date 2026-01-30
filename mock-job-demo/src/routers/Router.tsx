import { Routes, Route, Navigate } from 'react-router-dom';
import { StartScreen } from '../features/cheking_drawings/StartScreen';
import { ProcessingScreen } from '../components/upload/ProcessingScreen';
import { ResultScreen } from '../components/upload/ResultScreen';
import { CsvImageUploadScreen } from '../features/label_create/CsvImageUploadScreen';
import { CreateLabelScreen } from '../features/label_create/CreateLabelScreen';
import { HubScreen } from '../pages/HubScreen';
import { CreateLabelProcessingScreen } from '../features/label_create/CreateLabelProcessingScreen';
import { CreateLabelResultScreen } from '../features/label_create/CreateLabelResult';
import { DemoCreateLabelScreen } from '../features/label_create/DemoCreateLabelScreen';
import { DemoCreateLabelProcessingScreen } from '../features/label_create/DemoCreateLabelProcessingScreen';
import { DemoCreateLabelResultScreen } from '../features/label_create/DemoCreateLabelResult';
import { UpdateLabelScreen } from '../features/label_create/UpdateLabelScreen';
import { UpdateLabelProcessingScreen } from '../features/label_create/UpdateLabelProcessingScreen';
import { UpdateLabelResultScreen } from '../features/label_create/UpdateLabelResult';

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
      <Route path="/update-label" element={<UpdateLabelScreen />} />
      <Route path="/update-label-processing" element={<UpdateLabelProcessingScreen />} />
      <Route path="/update-label-result" element={<UpdateLabelResultScreen />} />
      <Route path="/demo-create-label-processing" element={<DemoCreateLabelProcessingScreen />} />
      <Route path="/demo-create-label-result" element={<DemoCreateLabelResultScreen />} />
      <Route path="/demo-create-label" element={<DemoCreateLabelScreen />} />
      <Route path="*" element={<Navigate to="/hub" replace />} />
    </Routes>
  )
};
