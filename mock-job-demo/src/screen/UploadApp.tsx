import React from 'react';
import { MemoryRouter, Routes, Route, Navigate } from 'react-router-dom';
import { UploadProvider } from './utils/UploadContext';
import { StartScreen, ProcessingScreen, ResultScreen, CsvImageUploadScreen, HubScreen } from './Screens';

const UploadApp: React.FC = () => {
  return (
    <MemoryRouter initialEntries={["/"]}>
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
    </MemoryRouter>
  );
};

export default UploadApp;
