import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { UploadProvider } from './utils/UploadContext';
import { StartScreen, ProcessingScreen, ResultScreen, CsvImageUploadScreen, HubScreen } from './Screens';

const UploadApp: React.FC = () => {
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

export default UploadApp;
