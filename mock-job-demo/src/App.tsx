import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { UploadProvider } from './screen/UploadContext';
import { StartScreen } from './screen/StartScreen';
import { ProcessingScreen } from './screen/ProcessingScreen';
import { ResultScreen } from './screen/ResultScreen';

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <UploadProvider>
        <Routes>
          <Route path="/" element={<StartScreen />} />
          <Route path="/processing" element={<ProcessingScreen />} />
          <Route path="/result" element={<ResultScreen />} />
          <Route path="*" element={<Navigate to="/" replace />} />
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
