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
import { DrawingReviewScreen } from '../features/drawing_review/DrawingReviewScreen';
import { DrawingReviewUploadExcelScreen } from '../features/drawing_review/DrawingReviewUploadExcelScreen';
import { DrawingReviewProcessingScreen } from '../features/drawing_review/DrawingReviewProcessingScreen';
import { DrawingReviewResultScreen } from '../features/drawing_review/DrawingReviewResultScreen';
import { DrawingCompareUploadScreen } from '../features/drawing_compare/DrawingCompareUploadScreen';
import { DrawingCompareUploadBaseFileScreen } from '../features/drawing_compare/DrawingCompareUploadBaseFileScreen';
import { DrawingCompareUploadCompareFileScreen } from '../features/drawing_compare/DrawingCompareUploadCompareFileScreen';
import { DrawingCompareSelectScreen } from '../features/drawing_compare/DrawingCompareSelectScreen';
import { DrawingCompareProcessingScreen } from '../features/drawing_compare/DrawingCompareProcessingScreen';
import { DrawingCompare } from '../features/drawing_compare/DrawingCompare';

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
      <Route path="/drawing-review" element={<DrawingReviewScreen />} />
      <Route path="/drawing-review-processing" element={<DrawingReviewProcessingScreen />} />
      <Route path="/drawing-review-result" element={<DrawingReviewResultScreen />} />
      <Route path="/drawing-review-upload-excel" element={<DrawingReviewUploadExcelScreen />} />
      <Route path="/drawing-compare-upload" element={<DrawingCompareUploadScreen />} />
      <Route path="/drawing-compare-upload-base" element={<DrawingCompareUploadBaseFileScreen />} />
      <Route path="/drawing-compare-upload-target" element={<DrawingCompareUploadCompareFileScreen />} />
      <Route path="/drawing-compare-select" element={<DrawingCompareSelectScreen />} />
      <Route path="/drawing-compare" element={<DrawingCompare />} />
      <Route path="/drawing-compare-processing" element={<DrawingCompareProcessingScreen />} />
      <Route path="/demo-create-label-processing" element={<DemoCreateLabelProcessingScreen />} />
      <Route path="/demo-create-label-result" element={<DemoCreateLabelResultScreen />} />
      <Route path="/demo-create-label" element={<DemoCreateLabelScreen />} />
      <Route path="*" element={<Navigate to="/hub" replace />} />
    </Routes>
  )
};
