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

function MaintenanceNotice({ until }: { until: string | null }) {
  return (
    <div className="container mx-auto px-4 py-16 max-w-3xl text-center">
      <div className="bg-brand-card rounded-2xl p-10 shadow-xl border border-brand-text/5">
        <h2 className="text-2xl sm:text-3xl font-serif font-bold mb-3">Under Maintenance</h2>
        <p className="text-brand-text/70 text-base sm:text-lg leading-relaxed">
          The submission portal is currently under maintenance and new submissions are temporarily disabled.
          {until ? (
            <>
              {' '}We expect the portal to be back online{' '}
              <span className="font-semibold">{new Date(until).toLocaleString()}</span>.
            </>
          ) : (
            ' Please check back again later.'
          )}
        </p>
      </div>
    </div>
  );
}

function maintenanceMessage(until: string | null) {
  return until
    ? `The portal is under maintenance. We will be back online ${new Date(until).toLocaleString()}.`
    : 'The portal is currently under maintenance. Please check back again later.';
}

export default function App() {
  const [currentView, setCurrentView] = useState<ViewState>('home');
  const [maintenanceMode, setMaintenanceMode] = useState<boolean>(false);
  const [maintenanceUntil, setMaintenanceUntil] = useState<string | null>(null);
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
          const s = data.settings || {};
          setMaintenanceMode(
            s.maintenance_user_enabled === 'true' ||
            (s.maintenance_user_enabled === undefined && s.maintenance_mode === 'true')
          );
          setMaintenanceUntil(s.maintenance_user_until || null);
        }
      } catch (err) {
        console.error('Failed to load settings:', err);
      }
    };
    fetchSettings();
  }, []);

  return (
    <>
      <MainLayout view={currentView} onNavigate={navigate} maintenanceMode={maintenanceMode} maintenanceUntil={maintenanceUntil}>
        {currentView === 'home' && (
          <HeroSection onStart={() => navigate('wizard')} maintenanceMode={maintenanceMode} maintenanceUntil={maintenanceUntil} />
        )}

        {currentView === 'wizard' &&
          (maintenanceMode ? (
            <MaintenanceNotice until={maintenanceUntil} />
          ) : (
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
          ))}

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
              maintenanceMode={maintenanceMode}
              maintenanceUntil={maintenanceUntil}
            />
          </Show>
        )}
      </MainLayout>
      <Analytics />
    </>
  );
}