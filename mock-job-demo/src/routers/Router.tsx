import { Routes, Route, Navigate } from 'react-router-dom';
import { CreateLabelScreen } from '../features/label_create/CreateLabelScreen';
import { HubScreen } from '../pages/HubScreen';
import { CreateLabelResultScreen } from '../features/label_create/CreateLabelResult';
import { UpdateLabelScreen } from '../features/label_create/UpdateLabelScreen';
import { UpdateLabelResultScreen } from '../features/label_create/UpdateLabelResult';
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

export const AppRouter = () => {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/hub" replace />} />
      <Route path="/hub" element={<HubScreen />} />
      <Route path="/create-label" element={<CreateLabelScreen />} />
      <Route path="/create-label-result" element={<CreateLabelResultScreen />} />
      <Route path="/update-label" element={<UpdateLabelScreen />} />
      <Route path="/update-label-result" element={<UpdateLabelResultScreen />} />
      <Route path="/drawing-review" element={<DrawingReviewScreen />} />
      <Route path="/drawing-review-result" element={<DrawingReviewResultScreen />} />
      <Route path="/drawing-review-upload-excel" element={<DrawingReviewUploadExcelScreen />} />
      <Route path="/drawing-compare-upload-base" element={<DrawingCompareUploadBaseFileScreen />} />
      <Route path="/drawing-compare-upload-target" element={<DrawingCompareUploadCompareFileScreen />} />
      <Route path="/drawing-compare" element={<DrawingCompare />} />
      <Route path="/drawing-compare-result" element={<DrawingCompareResultScreen />} />
      <Route path="/drawing-highlight-upload-before" element={<DrawingHighlightUploadBeforeFileScreen />} />
      <Route path="/drawing-highlight-upload-after" element={<DrawingHighlightUploadAfterFileScreen />} />
      <Route path="/drawing-highlight" element={<DrawingHighlight />} />
      <Route path="/drawing-highlight-result" element={<DrawingHighlightResultScreen />} />
      <Route path="/create-label-list" element={<CreateLabelListScreen />} />
      <Route path="/drawing-review-list" element={<DrawingReviewListScreen />} />
      <Route path="/drawing-compare-list" element={<DrawingCompareListScreen />} />
      <Route path="/drawing-highlight-list" element={<DrawingHighlightListScreen />} />
      <Route path="*" element={<Navigate to="/hub" replace />} />
    </Routes>
  )
};
