import { useState, useEffect, useRef } from 'react';
import { Show, SignInButton, useAuth, useUser } from '@clerk/react';
import { Analytics } from '@vercel/analytics/react';
import { MainLayout } from './components/layout/MainLayout';
import { HeroSection } from './components/portal/HeroSection';
import { SubmissionWizard } from './components/portal/SubmissionWizard';
import { MySubmissions, RegistrationConfig } from './components/portal/MySubmissions';
import { Phase2Page } from './components/portal/Phase2Page';
import { Phase2GuidelinesPage } from './components/portal/Phase2GuidelinesPage';

type ViewState = 'home' | 'wizard' | 'submissions' | 'phase2' | 'guidelines';

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

// Shown in place of the wizard when the server says this author may not submit
// yet. Without it the author fills in all three steps and uploads a file only
// to be refused, which reads as the approved-email list being broken rather
// than as a closed window.
function SubmissionClosedNotice({ message, email }: { message: string; email: string }) {
  return (
    <div className="container mx-auto px-4 py-16 max-w-3xl text-center">
      <div className="bg-brand-card rounded-2xl p-10 shadow-xl border border-brand-text/5">
        <h2 className="text-2xl sm:text-3xl font-serif font-bold mb-3">Submissions Are Not Open To Your Account</h2>
        <p className="text-brand-text/70 text-base sm:text-lg leading-relaxed">{message}</p>
        {email && (
          <p className="text-brand-text/50 text-sm mt-4">
            Signed in as <span className="font-semibold">{email}</span>. If that is not the address the
            conference team approved, sign in with the approved Google account instead.
          </p>
        )}
      </div>
    </div>
  );
}

export default function App() {
  const [currentView, setCurrentView] = useState<ViewState>('home');
  const [maintenanceMode, setMaintenanceMode] = useState<boolean>(false);
  const [maintenanceUntil, setMaintenanceUntil] = useState<string | null>(null);
  const [registrationOpen, setRegistrationOpen] = useState<boolean>(false);
  const [registration, setRegistration] = useState<RegistrationConfig | null>(null);
  // Admins can close file replacement independently of maintenance. Absent key
  // means allowed, matching fileEditsAllowed in backend/src/index.ts.
  const [fileEditsEnabled, setFileEditsEnabled] = useState<boolean>(true);
  // Admin "Phase 2" switch. Absent setting reads as OFF, so the Move to Phase 2
  // button stays hidden until it is explicitly turned on.
  const [phase2Enabled, setPhase2Enabled] = useState<boolean>(false);
  // Which submission the Phase 2 page is opened for. The portal has no URL
  // routing — views are in-memory state — so this can only be set by clicking
  // Move to Phase 2 on one of the author's own submissions; the backend
  // status endpoint re-checks ownership regardless.
  const [phase2SubmissionId, setPhase2SubmissionId] = useState<string>('');
  // Whether this signed-in author may create a submission, as decided by the
  // same gate that POST /api/submissions runs. The approved-email list is
  // redacted from /api/settings, so this cannot be worked out client-side.
  // null means "not checked yet" and is treated as allowed, so the wizard is
  // never blocked by a failed or slow pre-check.
  const [canSubmit, setCanSubmit] = useState<boolean | null>(null);
  const [submitBlockMessage, setSubmitBlockMessage] = useState<string>('');
  const [submitEmail, setSubmitEmail] = useState<string>('');
  // Whether this author already has at least one paper. Returned by the same
  // eligibility call that answers can-submit, so the two answers can never
  // disagree. Existing authors lose the Submit Paper tab and are landed on My
  // Submissions; the home page swaps its call-to-action accordingly.
  const [hasSubmissions, setHasSubmissions] = useState<boolean>(false);
  const [eligibilityLoaded, setEligibilityLoaded] = useState<boolean>(false);
  // Public acceptance switch. Used for signed-out visitors, who have no
  // eligibility answer to consult: if the portal is not accepting papers, the
  // home page says so instead of inviting them into a dead wizard.
  const [paperAcceptanceOpen, setPaperAcceptanceOpen] = useState<boolean>(true);
  // Admin-editable Scopus access list, threaded into the payment form.
  const [approvedScopusMailIds, setApprovedScopusMailIds] = useState<string>('');
  // One-shot landing on My Submissions after an existing author signs in, so
  // the portal does not open on a home page whose only nav tab is elsewhere.
  const landedOnSubmissions = useRef(false);
  const { getToken, isSignedIn } = useAuth();
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
          setRegistrationOpen(s.registration_open === 'true');
          // Fees, early-bird cutoff and bank details. The backend returns this
          // parsed and merged onto its defaults, so it is only null when the
          // request itself failed.
          if (data.registration) setRegistration(data.registration);
          setFileEditsEnabled(s.file_edits_enabled !== 'false');
          setPhase2Enabled(s.phase2_enabled === 'true');
          // Absent key means the call for papers is open (matching the backend),
          // so only the explicit 'false' closes the public view.
          setPaperAcceptanceOpen(s.paper_acceptance_enabled !== 'false');
          setApprovedScopusMailIds(s.approved_scopus_mail_ids || '');
        }
      } catch (err) {
        console.error('Failed to load settings:', err);
      }
    };
    fetchSettings();
  }, []);

  // Re-asked whenever the author is signed in and on every view change, so
  // flipping the acceptance switch or adding them to the list takes effect on
  // the next visit instead of after a hard refresh.
  useEffect(() => {
    if (!isSignedIn) {
      setCanSubmit(null);
      setSubmitBlockMessage('');
      setSubmitEmail('');
      setHasSubmissions(false);
      setEligibilityLoaded(false);
      return;
    }
    let cancelled = false;
    const fetchEligibility = async () => {
      try {
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8787';
        const token = await getToken();
        if (!token || cancelled) return;
        const res = await fetch(`${apiUrl}/api/submission-eligibility`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json().catch(() => null);
        if (cancelled) return;
        if (res.ok && data?.success) {
          setCanSubmit(data.can_submit === true);
          setSubmitBlockMessage(data.message || '');
          setSubmitEmail(data.email || '');
          setHasSubmissions(data.has_submissions === true || Number(data.submission_count) > 0);
        }
      } catch (err) {
        console.error('Failed to load submission eligibility:', err);
      } finally {
        if (!cancelled) setEligibilityLoaded(true);
      }
    };
    fetchEligibility();
    return () => {
      cancelled = true;
    };
  }, [isSignedIn, currentView, getToken]);

  // Sync the signed-in user's verified identity to the backend immediately on sign-in
  useEffect(() => {
    if (!isSignedIn || !clerkUser) return;
    const syncUser = async () => {
      try {
        const token = await getToken();
        if (!token) return;
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8787';
        await fetch(apiUrl + '/api/users/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
          body: JSON.stringify({
            name: clerkUser.fullName || '',
            email: clerkUser.primaryEmailAddress?.emailAddress || '',
          }),
        });
      } catch {
        // Non-fatal
      }
    };
    syncUser();
  }, [isSignedIn, clerkUser, getToken]);

  // ----- Submission-window state for this viewer -------------------------
  // Signed in: the server's eligibility answer is authoritative, because the
  // approved-email list is redacted from the public settings. Signed out: fall
  // back to the public switch, which is all an anonymous visitor can know.
  const authorHasSubmission = isSignedIn && hasSubmissions;
  const submissionsClosedForViewer = isSignedIn
    ? canSubmit === false
    : maintenanceMode || !paperAcceptanceOpen;
  // A brand-new author may open the wizard only when they are signed in, the
  // eligibility check has answered (so an existing author never sees the tab
  // flash), they are not already an author, and the window is open to them.
  const canStartSubmission = isSignedIn
    ? eligibilityLoaded && canSubmit !== false && !authorHasSubmission
    : !maintenanceMode && paperAcceptanceOpen;

  // Existing authors get one tab: My Submissions. Everyone else gets Home and
  // My Submissions, plus Submit Paper only while the window is open to them.
  const visibleNavViews: ('home' | 'wizard' | 'submissions')[] = authorHasSubmission
    ? ['submissions']
    : canStartSubmission
      ? ['home', 'wizard', 'submissions']
      : ['home', 'submissions'];

  // Land an existing author on their submissions once per sign-in. Guarded by a
  // ref so clicking the logo/Home afterwards is not immediately overridden.
  useEffect(() => {
    if (!isSignedIn) {
      landedOnSubmissions.current = false;
      return;
    }
    if (authorHasSubmission && !landedOnSubmissions.current) {
      landedOnSubmissions.current = true;
      setCurrentView('submissions');
    }
  }, [isSignedIn, authorHasSubmission]);

  return (
    <>
      <MainLayout
        view={currentView === 'phase2' || currentView === 'guidelines' ? 'submissions' : currentView}
        onNavigate={navigate}
        maintenanceMode={maintenanceMode}
        maintenanceUntil={maintenanceUntil}
        visibleNavViews={visibleNavViews}
        submissionsClosed={!maintenanceMode && submissionsClosedForViewer}
      >
        {currentView === 'home' && (
          <HeroSection
            onStart={() => navigate('wizard')}
            onMySubmissions={() => navigate('submissions')}
            hasSubmission={authorHasSubmission}
            submissionsClosed={submissionsClosedForViewer}
            maintenanceMode={maintenanceMode}
            maintenanceUntil={maintenanceUntil}
          />
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
              {authorHasSubmission ? (
                <SubmissionClosedNotice
                  message="You have already submitted a paper, so a second submission is not available from this portal. You can track your existing paper, upload revisions and complete registration from My Submissions."
                  email={submitEmail}
                />
              ) : canSubmit === false ? (
                <SubmissionClosedNotice
                  message={
                    submitBlockMessage ||
                    'New submissions are currently closed. Please contact the conference team if you need to submit a paper.'
                  }
                  email={submitEmail}
                />
              ) : (
                <SubmissionWizard
                  onComplete={() => navigate('home')}
                  onBack={() => navigate('home')}
                  getToken={getToken}
                  clerkUser={clerkUser}
                />
              )}
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
              registrationOpen={registrationOpen}
              registration={registration}
              fileEditsEnabled={fileEditsEnabled}
              phase2Enabled={phase2Enabled}
              onPhase2={(id) => {
                setPhase2SubmissionId(id);
                navigate('phase2');
              }}
              canStartSubmission={canStartSubmission}
              approvedScopusMailIds={approvedScopusMailIds}
              userEmail={
                [
                  clerkUser?.primaryEmailAddress?.emailAddress,
                  ...((clerkUser as any)?.emailAddresses?.map((e: any) => e?.emailAddress || e?.email) || []),
                  (clerkUser as any)?.emailAddress,
                ]
                  .filter(Boolean)
                  .join('\n')
              }
            />
          </Show>
        )}

        {/* Phase 2 (camera-ready + copyright) page. Signed-in guard here; the
            server-side ownership + eligibility check on the status endpoint is
            the real protection — a foreign or tampered submission id renders
            the Not Available state, never another author's data. */}
        {currentView === 'phase2' && (
          <Show
            when="signed-in"
            fallback={
              <SignInRequired
                title="Sign In Required"
                message="Please sign in to access the Phase 2 submission page."
              />
            }
          >
            <Phase2Page
              submissionId={phase2SubmissionId}
              getToken={getToken}
              onBack={() => navigate('submissions')}
              onGuidelines={() => navigate('guidelines')}
            />
          </Show>
        )}

        {/* Phase 2 Guidelines page (hidden, accessible from Phase 2) */}
        {currentView === 'guidelines' && (
          <Phase2GuidelinesPage
            onBack={() => navigate(phase2SubmissionId ? 'phase2' : 'submissions')}
          />
        )}
      </MainLayout>
      <Analytics />
    </>
  );
}