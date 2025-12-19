import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { UploadProvider } from './UploadContext';
import { StartScreen, ProcessingScreen, ResultScreen } from './Screens';

const UploadApp: React.FC = () => {
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

export default UploadApp;
