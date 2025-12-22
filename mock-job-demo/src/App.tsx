import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { UploadProvider } from './screen/utils/UploadContext';
import { StartScreen } from './screen/cheking-drawings/StartScreen';
import { ProcessingScreen } from './screen/utils/ProcessingScreen';
import { ResultScreen } from './screen/utils/ResultScreen';
import { CsvImageUploadScreen } from './screen/label-create/CsvImageUploadScreen';
import { HubScreen } from './screen/HubScreen';

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <UploadProvider>
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
    </BrowserRouter>
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
