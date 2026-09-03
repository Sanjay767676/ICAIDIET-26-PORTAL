import React, { useState } from 'react';
import { MainLayout } from './components/layout/MainLayout';
import { HeroSection } from './components/portal/HeroSection';
import { SubmissionWizard } from './components/portal/SubmissionWizard';

type ViewState = 'home' | 'wizard';

export default function App() {
  const [currentView, setCurrentView] = useState<ViewState>('home');

  const handleStartSubmission = () => {
    setCurrentView('wizard');
  };

  const handleBackHome = () => {
    setCurrentView('home');
  };

  return (
    <MainLayout>
      {currentView === 'home' && <HeroSection onStart={handleStartSubmission} />}
      {currentView === 'wizard' && <SubmissionWizard onComplete={handleBackHome} onBack={handleBackHome} />}
    </MainLayout>
  );
}
