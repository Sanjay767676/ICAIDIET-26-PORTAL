import { useState } from 'react';
import { Show, SignInButton, useAuth } from '@clerk/react';
import { MainLayout } from './components/layout/MainLayout';
import { HeroSection } from './components/portal/HeroSection';
import { SubmissionWizard } from './components/portal/SubmissionWizard';

type ViewState = 'home' | 'wizard';

export default function App() {
  const [currentView, setCurrentView] = useState<ViewState>('home');
  const { getToken } = useAuth();

  const handleStartSubmission = () => {
    setCurrentView('wizard');
  };

  const handleBackHome = () => {
    setCurrentView('home');
  };

  return (
    <MainLayout>
      {currentView === 'home' && <HeroSection onStart={handleStartSubmission} />}
      {currentView === 'wizard' && (
        <Show
          when="signed-in"
          fallback={
            <div className="container mx-auto px-4 py-20 max-w-4xl text-center">
              <div className="bg-brand-card rounded-2xl p-12 shadow-xl border border-brand-text/5">
                <h2 className="text-3xl font-serif font-bold mb-4">Sign In Required</h2>
                <p className="text-brand-text/70 text-lg mb-8">
                  Please sign in or create an account to submit your paper.
                </p>
                <SignInButton mode="modal">
                  <button className="px-8 py-3 bg-brand-text text-white rounded-xl font-semibold hover:bg-brand-accent hover:-translate-y-0.5 transition-all shadow-lg">
                    Sign In to Submit
                  </button>
                </SignInButton>
              </div>
            </div>
          }
        >
          <SubmissionWizard
            onComplete={handleBackHome}
            onBack={handleBackHome}
            getToken={getToken}
          />
        </Show>
      )}
    </MainLayout>
  );
}