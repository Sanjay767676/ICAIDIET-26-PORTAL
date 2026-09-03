import React, { useState } from 'react';
import { MainLayout } from './components/layout/MainLayout';
import { HeroSection } from './components/portal/HeroSection';
import { AuthPage } from './components/portal/AuthPage';
import { SubmissionWizard } from './components/portal/SubmissionWizard';
import { CheckCircle } from 'lucide-react';

type ViewState = 'home' | 'auth' | 'wizard' | 'success';

export default function App() {
  const [currentView, setCurrentView] = useState<ViewState>('home');
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const handleStartSubmission = () => {
    setCurrentView('wizard');
  };

  const handleLogin = () => {
    setIsAuthenticated(true);
    setCurrentView('wizard');
  };

  const handleSubmissionComplete = () => {
    setCurrentView('success');
  };

  return (
    <MainLayout>
      {currentView === 'home' && (
        <HeroSection onStart={handleStartSubmission} />
      )}
      
      {currentView === 'auth' && (
        <AuthPage onLogin={handleLogin} />
      )}

      {currentView === 'wizard' && (
        <SubmissionWizard onComplete={handleSubmissionComplete} />
      )}

      {currentView === 'success' && (
        <div className="flex-1 flex items-center justify-center p-4 py-32">
          <div className="bg-brand-card w-full max-w-md rounded-2xl p-8 shadow-xl border border-brand-text/5 text-center animate-in zoom-in duration-500">
            <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
            <h2 className="font-serif text-3xl font-bold mb-2">Submission Successful!</h2>
            <p className="text-brand-text/80 mb-8">
              Your paper has been submitted to ICAIDIET'26. We will notify you once the peer-review process is complete.
            </p>
            <button 
              onClick={() => setCurrentView('home')}
              className="bg-brand-text text-white px-6 py-2.5 rounded-lg font-medium hover:bg-brand-accent transition-colors"
            >
              Return Home
            </button>
          </div>
        </div>
      )}
    </MainLayout>
  );
}
