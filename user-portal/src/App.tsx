import { useState, useEffect } from 'react';
import { Show, SignInButton, useAuth, useUser } from '@clerk/react';
import { Analytics } from '@vercel/analytics/react';
import { MainLayout } from './components/layout/MainLayout';
import { HeroSection } from './components/portal/HeroSection';
import { SubmissionWizard } from './components/portal/SubmissionWizard';
import { MySubmissions } from './components/portal/MySubmissions';

type ViewState = 'home' | 'wizard' | 'submissions';

function SignInRequired({ title, message }: { title: string; message: string }) {
  return (
    <div className="container mx-auto px-4 py-20 max-w-4xl text-center">
      <div className="bg-brand-card rounded-2xl p-12 shadow-xl border border-brand-text/5">
        <h2 className="text-3xl font-serif font-bold mb-4">{title}</h2>
        <p className="text-brand-text/70 text-lg mb-8">{message}</p>
        <SignInButton mode="modal">
          <button className="px-8 py-3 bg-brand-text text-white rounded-xl font-semibold hover:bg-brand-accent hover:-translate-y-0.5 transition-all shadow-lg">
            Sign In to Continue
          </button>
        </SignInButton>
      </div>
    </div>
  );
}

export default function App() {
  const [currentView, setCurrentView] = useState<ViewState>('home');
  const [maintenanceMode, setMaintenanceMode] = useState<boolean>(false);
  const { getToken } = useAuth();
  const { user: clerkUser } = useUser();

  const navigate = (view: ViewState) => setCurrentView(view);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8787';
        const res = await fetch(`${apiUrl}/api/settings`);
        const data = await res.json().catch(() => null);
        if (res.ok && data?.success) {
          setMaintenanceMode(data.settings?.maintenance_mode === 'true');
        }
      } catch (err) {
        console.error('Failed to load settings:', err);
      }
    };
    fetchSettings();
  }, []);

  return (
    <>
      <MainLayout view={currentView} onNavigate={navigate} maintenanceMode={maintenanceMode}>
        {currentView === 'home' && <HeroSection onStart={() => navigate('wizard')} maintenanceMode={maintenanceMode} />}

        {currentView === 'wizard' && (
          <Show
            when="signed-in"
            fallback={
              <SignInRequired
                title="Sign In Required"
                message="Please sign in or create an account to submit your paper."
              />
            }
          >
            <SubmissionWizard
              onComplete={() => navigate('home')}
              onBack={() => navigate('home')}
              getToken={getToken}
              clerkUser={clerkUser}
            />
          </Show>
        )}

        {currentView === 'submissions' && (
          <Show
            when="signed-in"
            fallback={
              <SignInRequired
                title="Sign In Required"
                message="Please sign in to view your submissions."
              />
            }
          >
            <MySubmissions
              getToken={getToken}
              onBack={() => navigate('home')}
              onStart={() => navigate('wizard')}
            />
          </Show>
        )}
      </MainLayout>
      <Analytics />
    </>
  );
}