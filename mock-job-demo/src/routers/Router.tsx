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
import { CreateLabelReUploadScreen } from '../features/label_create/CreateLabelReUploadScreen';
import { DemoUpdateLabelScreen } from '../features/label_create/DemoUpdateLabelScreen';
import { DemoUpdateLabelProcessingScreen } from '../features/label_create/DemoUpdateLabelProcessingScreen';
import { DemoUpdateLabelResultScreen } from '../features/label_create/DemoUpdateLabelResult';

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
      <Route path="/create-label-re-upload" element={<CreateLabelReUploadScreen />} />
      <Route path="/demo-create-label-processing" element={<DemoCreateLabelProcessingScreen />} />
      <Route path="/demo-create-label-result" element={<DemoCreateLabelResultScreen />} />
      <Route path="/demo-create-label" element={<DemoCreateLabelScreen />} />
      <Route path="/update-label" element={<DemoUpdateLabelScreen />} />
      <Route path="/demo-update-label-processing" element={<DemoUpdateLabelProcessingScreen />} />
      <Route path="/demo-update-label-result" element={<DemoUpdateLabelResultScreen />} />
      <Route path="*" element={<Navigate to="/hub" replace />} />
    </Routes>
  )
};
