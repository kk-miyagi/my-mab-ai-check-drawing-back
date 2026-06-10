import { Routes, Route, Navigate } from 'react-router-dom';
import { CreateLabelScreen } from '../features/label_create/CreateLabelScreen';
import { HubScreen } from '../pages/HubScreen';
import { CreateLabelResultScreen } from '../features/label_create/CreateLabelResult';
import { UpdateLabelScreen } from '../features/label_create/UpdateLabelScreen';
import { DrawingReviewScreen } from '../features/drawing_review/DrawingReviewScreen';
import { DrawingReviewUploadExcelScreen } from '../features/drawing_review/DrawingReviewUploadExcelScreen';
import { DrawingReviewResultScreen } from '../features/drawing_review/DrawingReviewResultScreen';
import { DrawingCompareUploadBaseFileScreen } from '../features/drawing_compare/DrawingCompareUploadBaseFileScreen';
import { DrawingCompareUploadCompareFileScreen } from '../features/drawing_compare/DrawingCompareUploadCompareFileScreen';
import { DrawingHighlightUploadBeforeFileScreen } from '../features/drawing_highlight/DrawingHighlightUploadBeforeFileScreen';
import { DrawingHighlightUploadAfterFileScreen } from '../features/drawing_highlight/DrawingHighlightUploadAfterFileScreen';
import { DrawingCompare } from '../features/drawing_compare/DrawingCompare';
import { DrawingCompareResultScreen } from '../features/drawing_compare/DrawingCompareResultScreen';
import { DrawingHighlight } from '../features/drawing_highlight/DrawingHighlight';
import { DrawingHighlightResultScreen } from '../features/drawing_highlight/DrawingHighlightResultScreen';
import { CreateLabelListScreen } from '../features/label_create/CreateLabelListScreen';
import { DrawingReviewListScreen } from '../features/drawing_review/DrawingReviewListScreen';
import { DrawingCompareListScreen } from '../features/drawing_compare/DrawingCompareListScreen';
import { DrawingHighlightListScreen } from '../features/drawing_highlight/DrawingHighlightListScreen';
import { TroubleSearch } from '../features/trouble/TroubleSearch';
import { TroubleResult } from '../features/trouble/TroubleResult';
import { TroubleListScreen } from '../features/trouble/TroubleListScreen';
import { LoginPage } from '../pages/LoginPage';
import { ProtectedRoute } from './ProtectedRoute';

export const AppRouter = () => {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/hub" replace />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/hub" element={<ProtectedRoute><HubScreen /></ProtectedRoute>} />
      <Route path="/create-label" element={<ProtectedRoute><CreateLabelScreen /></ProtectedRoute>} />
      <Route path="/create-label-result" element={<ProtectedRoute><CreateLabelResultScreen /></ProtectedRoute>} />
      <Route path="/update-label" element={<ProtectedRoute><UpdateLabelScreen /></ProtectedRoute>} />
      <Route path="/drawing-review" element={<ProtectedRoute><DrawingReviewScreen /></ProtectedRoute>} />
      <Route path="/drawing-review-result" element={<ProtectedRoute><DrawingReviewResultScreen /></ProtectedRoute>} />
      <Route path="/drawing-review-upload-excel" element={<ProtectedRoute><DrawingReviewUploadExcelScreen /></ProtectedRoute>} />
      <Route path="/drawing-compare-upload-base" element={<ProtectedRoute><DrawingCompareUploadBaseFileScreen /></ProtectedRoute>} />
      <Route path="/drawing-compare-upload-target" element={<ProtectedRoute><DrawingCompareUploadCompareFileScreen /></ProtectedRoute>} />
      <Route path="/drawing-compare" element={<ProtectedRoute><DrawingCompare /></ProtectedRoute>} />
      <Route path="/drawing-compare-result" element={<ProtectedRoute><DrawingCompareResultScreen /></ProtectedRoute>} />
      <Route path="/drawing-highlight-upload-before" element={<ProtectedRoute><DrawingHighlightUploadBeforeFileScreen /></ProtectedRoute>} />
      <Route path="/drawing-highlight-upload-after" element={<ProtectedRoute><DrawingHighlightUploadAfterFileScreen /></ProtectedRoute>} />
      <Route path="/drawing-highlight" element={<ProtectedRoute><DrawingHighlight /></ProtectedRoute>} />
      <Route path="/drawing-highlight-result" element={<ProtectedRoute><DrawingHighlightResultScreen /></ProtectedRoute>} />
      <Route path="/create-label-list" element={<ProtectedRoute><CreateLabelListScreen /></ProtectedRoute>} />
      <Route path="/drawing-review-list" element={<ProtectedRoute><DrawingReviewListScreen /></ProtectedRoute>} />
      <Route path="/drawing-compare-list" element={<ProtectedRoute><DrawingCompareListScreen /></ProtectedRoute>} />
      <Route path="/drawing-highlight-list" element={<ProtectedRoute><DrawingHighlightListScreen /></ProtectedRoute>} />
      <Route path="/trouble-search" element={<ProtectedRoute><TroubleSearch /></ProtectedRoute>} />
      <Route path="/trouble-result" element={<ProtectedRoute><TroubleResult /></ProtectedRoute>} />
      <Route path="/trouble-list" element={<ProtectedRoute><TroubleListScreen /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/hub" replace />} />
    </Routes>
  )
};
