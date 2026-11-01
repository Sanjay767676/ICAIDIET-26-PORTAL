import { ArrowRight, Inbox } from 'lucide-react';

export function HeroSection({
  onStart,
  onMySubmissions,
  hasSubmission = false,
  submissionsClosed = false,
  maintenanceMode,
  maintenanceUntil,
}: {
  onStart: () => void;
  onMySubmissions?: () => void;
  // The signed-in author already has a paper on file: the call for papers is
  // not offered to them again, My Submissions is. Mirrors the hidden Submit
  // Paper tab in the header.
  hasSubmission?: boolean;
  // New-paper submissions are closed for this viewer (acceptance switch off,
  // approved-list mismatch, or maintenance). The button stops being a way in.
  submissionsClosed?: boolean;
  maintenanceMode?: boolean;
  maintenanceUntil?: string | null;
}) {
  const maintenanceText = maintenanceUntil
    ? `The portal is currently under maintenance. We will be back online ${new Date(maintenanceUntil).toLocaleString()}.`
    : 'The portal is currently under maintenance. New submissions are temporarily disabled. Please check back again later.';
  const closedText =
    'New paper submissions are currently closed. Authors who already submitted can sign in and open My Submissions.';
  const blocked = Boolean(maintenanceMode) || submissionsClosed;

  return (
    <div className="relative overflow-hidden">
      {/* Hero Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-12 flex flex-col items-center">
        {/* Conference full name */}
        <h2 className="text-2xl sm:text-3xl md:text-4xl font-serif font-bold text-brand-text text-center w-full max-w-3xl leading-snug mb-2">
          Welcome To ICAIDIET'26
        </h2>
        <h2 className="text-base sm:text-xl md:text-2xl font-serif font-bold text-brand-text text-center w-full max-w-3xl leading-snug mb-6">
          Paper Submission Portal
        </h2>

        {/* Submission-window state, stated before any button is pressed. */}
        {hasSubmission ? (
          <div className="mb-6 w-full max-w-2xl rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-center text-sm font-semibold text-emerald-900">
            You have already submitted a paper. Use My Submissions to track it, upload revisions or
            complete registration.
          </div>
        ) : blocked ? (
          <div className="mb-6 w-full max-w-2xl rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-center text-sm font-semibold text-amber-900">
            {maintenanceMode
              ? 'The submission portal is under maintenance. New submissions are temporarily disabled.'
              : 'Not accepting new paper submissions right now.'}
          </div>
        ) : null}

        {/* Buttons */}

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full max-w-2xl">
          {hasSubmission ? (
            <button
              onClick={() => onMySubmissions?.()}
              className="w-full sm:w-auto px-8 py-4 text-white rounded-xl font-semibold text-lg flex items-center justify-center gap-2 group transition-all shadow-xl bg-brand-text hover:bg-brand-accent hover:-translate-y-1"
            >
              <Inbox className="w-5 h-5" />
              View My Submissions
            </button>
          ) : (
            <button
              onClick={() => {
                if (maintenanceMode) alert(maintenanceText);
                else if (submissionsClosed) alert(closedText);
                else onStart();
              }}
              className={`w-full sm:w-auto px-8 py-4 text-white rounded-xl font-semibold text-lg flex items-center justify-center gap-2 group transition-all shadow-xl ${
                blocked
                  ? 'bg-gray-500 cursor-not-allowed opacity-80'
                  : 'bg-brand-text hover:bg-brand-accent hover:-translate-y-1'
              }`}
            >
              {maintenanceMode
                ? 'Portal Under Maintenance'
                : submissionsClosed
                  ? 'Submissions Closed'
                  : 'Go to Submission Portal'}
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
          )}
          <a
            href="https://www.icaidiet26.tech/paper-submission"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full sm:w-auto px-8 py-4 bg-white/50 backdrop-blur-sm border border-brand-text/10 text-brand-text rounded-xl font-semibold text-lg hover:bg-white transition-all text-center"
          >
            Author Guidelines
          </a>
        </div>

        <div className="mt-4 flex flex-col sm:flex-row items-center justify-center gap-4 w-full max-w-2xl">
          <a
            href="https://www.novelcheckr.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full sm:w-auto px-8 py-4 bg-red-600 text-white rounded-xl font-semibold text-lg hover:bg-red-700 transition-all text-center shadow-xl"
          >
            Plagiarism Checker at ₹99
          </a>
          <a
            href="/Conference_paper_Template.docx"
            download
            className="w-full sm:w-auto px-8 py-4 bg-black text-white rounded-xl font-semibold text-lg hover:bg-gray-800 transition-all text-center shadow-xl"
          >
            Download Template
          </a>
        </div>
      </div>
    </div>
  );
}
