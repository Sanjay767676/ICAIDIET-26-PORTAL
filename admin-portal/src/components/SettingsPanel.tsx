import React, { useState, useEffect, useCallback } from 'react';
import {
  Settings,
  FileText,
  Shield,
  Mail,
  Download,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Wrench,
  ChevronRight,
  Users,
  CreditCard,
  Eye,
  EyeOff,
  HardDrive,
  ToggleLeft,
  MailPlus,
  Info,
  Trash2,
  Plus,
  FileCheck,
} from 'lucide-react';
import MailField from './MailField';
import RegistrationConfigPanel, { RegistrationConfig } from './RegistrationConfigPanel';

/* ---------- Shared toggle ---------- */
function Toggle({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      disabled={disabled}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-brand-accent focus:ring-offset-2 ${
        checked ? 'bg-brand-accent' : 'bg-gray-300'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      role="switch"
      aria-checked={checked}
    >
      <span className="sr-only">{label}</span>
      <span
        aria-hidden="true"
        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  );
}

/* ---------- Status pill ---------- */
function StatusPill({ active, activeText, inactiveText }: { active: boolean; activeText: string; inactiveText: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-semibold rounded-full px-2.5 py-1 ${
        active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
      }`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-green-600' : 'bg-red-600'}`} />
      {active ? activeText : inactiveText}
    </span>
  );
}

/* ---------- Section wrapper ---------- */
function SettingCard({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden ${className}`}>
      {children}
    </div>
  );
}

function CardHeader({
  title,
  description,
  right,
}: {
  title: string;
  description?: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 px-5 py-4">
      <div className="min-w-0">
        <h4 className="font-semibold text-stone-900 text-[15px]">{title}</h4>
        {description && <p className="text-sm text-stone-500 mt-1 leading-relaxed">{description}</p>}
      </div>
      {right && <div className="shrink-0 pt-0.5">{right}</div>}
    </div>
  );
}

function CardFooter({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-3 px-5 py-3 bg-stone-50 border-t border-stone-100">
      {children}
    </div>
  );
}

/* ---------- Sidebar nav items ---------- */
type SettingsSection = 'submissions' | 'access' | 'maintenance' | 'templates' | 'data';

const NAV_ITEMS: { key: SettingsSection; label: string; icon: typeof Settings }[] = [
  { key: 'submissions', label: 'Submission Controls', icon: FileText },
  { key: 'access', label: 'Access & Emails', icon: Shield },
  { key: 'maintenance', label: 'Maintenance', icon: Wrench },
  { key: 'templates', label: 'Mail Templates', icon: Mail },
  { key: 'data', label: 'Data & Backup', icon: HardDrive },
];

/* ---------- Interface for all settings props ---------- */
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8787';

export interface PaymentAccessGrant {
  id: string;
  submission_id: string;
  paper_title: string;
  paper_id?: string;
  submission_code?: string;
  author_email?: string;
  clerk_id?: string;
  granted_at?: string;
}

export interface SettingsPanelProps {
  token?: string;
  onUnauthorized?: () => void;
  submissions?: any[];
  // Submission controls
  paperAcceptanceEnabled: boolean;
  setPaperAcceptanceEnabled: (v: boolean) => void;
  fileEditsEnabled: boolean;
  setFileEditsEnabled: (v: boolean) => void;
  registrationOpen: boolean;
  setRegistrationOpen: (v: boolean) => void;
  phase2Enabled: boolean;
  setPhase2Enabled: (v: boolean) => void;

  // Access / approved emails
  approvedMailEnabled: boolean;
  setApprovedMailEnabled: (v: boolean) => void;
  approvedMailIds: string;
  setApprovedMailIds: (v: string) => void;
  savedApprovedMailIds: string;
  approvedMailCheck: string;
  setApprovedMailCheck: (v: string) => void;
  savingApprovedMail: boolean;
  approvedMailMessage: string | null;
  approvedMailError: string | null;
  setApprovedMailMessage: (v: string | null) => void;
  setApprovedMailError: (v: string | null) => void;
  saveApprovedMailIds: () => void;

  // Scopus
  approvedScopusMailIds: string;
  setApprovedScopusMailIds: (v: string) => void;
  savingApprovedScopus: boolean;
  approvedScopusMsg: string | null;
  approvedScopusErr: string | null;
  saveApprovedScopusMailIds: () => void;

  // Maintenance
  mtUserEnabled: boolean;
  setMtUserEnabled: (v: boolean) => void;
  mtUserUntil: string;
  setMtUserUntil: (v: string) => void;
  mtReviewEnabled: boolean;
  setMtReviewEnabled: (v: boolean) => void;
  mtReviewUntil: string;
  setMtReviewUntil: (v: string) => void;

  // Mail templates
  mailTemplates: { id: string; name: string; subject: string; body: string; created_at?: string; updated_at?: string }[];
  mailTemplatesLoading: boolean;
  mailTemplatesError: string | null;
  templateDraft: { id: string; name: string; subject: string; body: string } | null;
  setTemplateDraft: React.Dispatch<React.SetStateAction<{ id: string; name: string; subject: string; body: string } | null>>;
  savingTemplate: boolean;
  saveMailTemplate: (t: { id: string; name: string; subject: string; body: string }) => void;
  deleteMailTemplate: (id: string) => void;

  // Backup
  backingUp: boolean;
  backupMessage: string | null;
  backupError: string | null;
  downloadBackup: () => void;

  // Registration config
  registrationConfig: RegistrationConfig;
  setRegistrationConfig: (v: RegistrationConfig) => void;

  // Global
  savingSettings: boolean;
  savePortalSettings: () => void;
  error: string | null;
}

export default function SettingsPanel(props: SettingsPanelProps) {
  const [section, setSection] = useState<SettingsSection>('submissions');
  const [paymentGrants, setPaymentGrants] = useState<PaymentAccessGrant[]>([]);
  const [loadingGrants, setLoadingGrants] = useState(false);
  const [newPaperTitle, setNewPaperTitle] = useState('');
  const [addingGrant, setAddingGrant] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [grantError, setGrantError] = useState<string | null>(null);
  const [grantSuccess, setGrantSuccess] = useState<string | null>(null);

  const fetchPaymentGrants = useCallback(async () => {
    if (!props.token) return;
    setLoadingGrants(true);
    try {
      const res = await fetch(`${API_URL}/api/admin/payment-access`, {
        headers: { Authorization: `Bearer ${props.token}` },
      });
      if (res.status === 401) {
        props.onUnauthorized?.();
        return;
      }
      const data = await res.json().catch(() => null);
      if (res.ok && data?.success) {
        setPaymentGrants(data.grants || []);
      }
    } catch (err) {
      console.error('Failed to load payment access grants:', err);
    } finally {
      setLoadingGrants(false);
    }
  }, [props.token, props.onUnauthorized]);

  useEffect(() => {
    fetchPaymentGrants();
  }, [fetchPaymentGrants]);

  const handleAddPaymentAccess = async () => {
    if (props.registrationOpen) {
      setGrantError('Ready for Registration is currently turned on. Turn it off to use manual paper payment access.');
      return;
    }
    const title = newPaperTitle.trim();
    if (!title) {
      setGrantError('Please enter a paper title.');
      return;
    }
    setAddingGrant(true);
    setGrantError(null);
    setGrantSuccess(null);
    try {
      const res = await fetch(`${API_URL}/api/admin/payment-access`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${props.token}`,
        },
        body: JSON.stringify({ title }),
      });
      if (res.status === 401) {
        props.onUnauthorized?.();
        return;
      }
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || 'Failed to grant payment access.');
      }
      const grant = data.grant as PaymentAccessGrant;
      setGrantSuccess(
        `Payment access approved: "${grant.paper_title}" (ID: ${grant.paper_id || grant.submission_id.slice(0, 8)}, Email: ${grant.author_email || 'N/A'}, Clerk ID: ${grant.clerk_id || 'Not linked'})`
      );
      setNewPaperTitle('');
      setPaymentGrants((prev) => [grant, ...prev.filter((g) => g.submission_id !== grant.submission_id)]);
    } catch (err: any) {
      setGrantError(err?.message || 'Failed to grant payment access.');
    } finally {
      setAddingGrant(false);
    }
  };

  const handleRevokePaymentAccess = async (id: string) => {
    setRevokingId(id);
    setGrantError(null);
    setGrantSuccess(null);
    try {
      const res = await fetch(`${API_URL}/api/admin/payment-access/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${props.token}` },
      });
      if (res.status === 401) {
        props.onUnauthorized?.();
        return;
      }
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || 'Failed to revoke payment access.');
      }
      setPaymentGrants((prev) => prev.filter((g) => g.id !== id && g.submission_id !== id));
      setGrantSuccess('Payment access revoked.');
      setTimeout(() => setGrantSuccess(null), 3000);
    } catch (err: any) {
      setGrantError(err?.message || 'Failed to revoke payment access.');
    } finally {
      setRevokingId(null);
    }
  };

  return (
    <div className="max-w-7xl mx-auto mt-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-xl bg-stone-900 text-white flex items-center justify-center">
            <Settings className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-serif text-2xl font-bold text-stone-900">Portal Settings</h3>
            <p className="text-sm text-stone-500">Manage submissions, access control, maintenance & templates</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Sidebar nav */}
        <nav className="lg:w-56 shrink-0">
          <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden lg:sticky lg:top-6">
            {/* Horizontal scrollable on mobile, vertical on desktop */}
            <div className="flex lg:flex-col overflow-x-auto lg:overflow-x-visible p-1.5 gap-0.5">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const active = section === item.key;
                return (
                  <button
                    key={item.key}
                    onClick={() => setSection(item.key)}
                    className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                      active
                        ? 'bg-stone-900 text-white shadow-sm'
                        : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{item.label}</span>
                    {active && <ChevronRight className="w-3.5 h-3.5 ml-auto hidden lg:block" />}
                  </button>
                );
              })}
            </div>
          </div>
        </nav>

        {/* Main content */}
        <div className="flex-1 min-w-0 space-y-5">
          {/* ==================== SUBMISSION CONTROLS ==================== */}
          {section === 'submissions' && (
            <>
              <div className="flex items-center justify-between mb-1">
                <div>
                  <h4 className="text-lg font-serif font-bold text-stone-900">Submission Controls</h4>
                  <p className="text-sm text-stone-500 mt-0.5">Control what authors can do on the user portal</p>
                </div>
              </div>

              {/* Accepting Paper Submissions */}
              <SettingCard>
                <CardHeader
                  title="Accepting Paper Submissions"
                  description={
                    <>
                      When on, the user portal accepts new paper submissions. When off, nobody can start a new
                      paper — unless their email is on the Approved Email IDs list. Authors can still replace
                      files on papers they already submitted; that is controlled separately by Allow File Edits.
                    </>
                  }
                  right={
                    <Toggle
                      checked={props.paperAcceptanceEnabled}
                      onChange={props.setPaperAcceptanceEnabled}
                      disabled={props.savingSettings}
                      label="Toggle accepting paper submissions"
                    />
                  }
                />
                <CardFooter>
                  <StatusPill
                    active={props.paperAcceptanceEnabled}
                    activeText="Accepting submissions"
                    inactiveText="Not accepting submissions"
                  />
                  <span className="text-xs text-stone-400">Save settings below to apply</span>
                </CardFooter>
              </SettingCard>

              {/* Allow File Edits */}
              <SettingCard>
                <CardHeader
                  title="Allow File Edits"
                  description={
                    <>
                      When on, authors can replace the files on a paper they have already submitted.
                      Turn this off to close revisions without taking the portal into maintenance —
                      new submissions are still accepted. This is the only switch that governs file replacement.
                    </>
                  }
                  right={
                    <Toggle
                      checked={props.fileEditsEnabled}
                      onChange={props.setFileEditsEnabled}
                      disabled={props.savingSettings}
                      label="Toggle author file edits"
                    />
                  }
                />
                <CardFooter>
                  <StatusPill
                    active={props.fileEditsEnabled}
                    activeText="Authors can edit files"
                    inactiveText="File edits closed"
                  />
                  <span className="text-xs text-stone-400">
                    {props.fileEditsEnabled
                      ? 'The "Edit Files" button is showing in the user portal.'
                      : 'The "Edit Files" button is hidden and the upload endpoint refuses replacements.'}
                  </span>
                </CardFooter>
              </SettingCard>

              {/* Ready for Registration */}
              <SettingCard>
                <CardHeader
                  title="Ready for Registration"
                  description="When on, authors of accepted papers will see the payment form in their portal."
                  right={
                    <Toggle
                      checked={props.registrationOpen}
                      onChange={props.setRegistrationOpen}
                      disabled={props.savingSettings}
                      label="Toggle registration"
                    />
                  }
                />
              </SettingCard>

              {/* Phase 2 — Camera Ready & Copyright */}
              <SettingCard>
                <CardHeader
                  title="Phase 2 — Camera Ready & Copyright"
                  description={
                    <>
                      When on, authors of accepted papers whose payment is approved see a
                      &quot;Move to Phase 2&quot; button and can submit their camera-ready manuscript,
                      the signed copyright form, their mode of attending, and the declaration.
                      Off by default.
                    </>
                  }
                  right={
                    <Toggle
                      checked={props.phase2Enabled}
                      onChange={props.setPhase2Enabled}
                      disabled={props.savingSettings}
                      label="Toggle Phase 2 submissions"
                    />
                  }
                />
                <CardFooter>
                  <StatusPill
                    active={props.phase2Enabled}
                    activeText="Phase 2 open"
                    inactiveText="Phase 2 closed"
                  />
                  <span className="text-xs text-stone-400">
                    {props.phase2Enabled
                      ? 'Eligible authors see the "Move to Phase 2" button in the user portal.'
                      : 'The "Move to Phase 2" button is hidden and the endpoint refuses requests.'}
                  </span>
                </CardFooter>
              </SettingCard>

              {/* Save button */}
              <div className="flex items-center justify-end pt-2">
                <button
                  onClick={props.savePortalSettings}
                  disabled={props.savingSettings}
                  className="inline-flex items-center gap-2 px-6 py-2.5 bg-stone-900 text-white rounded-xl text-sm font-semibold hover:bg-stone-800 transition-all disabled:opacity-50 shadow-md"
                >
                  {props.savingSettings && <Loader2 className="w-4 h-4 animate-spin" />}
                  {props.savingSettings ? 'Saving...' : 'Save Submission Settings'}
                </button>
              </div>
            </>
          )}

          {/* ==================== ACCESS & EMAILS ==================== */}
          {section === 'access' && (
            <>
              <div className="mb-1">
                <h4 className="text-lg font-serif font-bold text-stone-900">Access & Email Lists</h4>
                <p className="text-sm text-stone-500 mt-0.5">Manage exemption lists and special access permissions</p>
              </div>

              {/* Approved Email IDs */}
              <SettingCard>
                <CardHeader
                  title="Approved Email IDs"
                  description={
                    <>
                      An exemption list, independent of every other switch. While this is <strong>off</strong>{' '}
                      it does nothing at all. Turn it <strong>on</strong> and enter the email addresses that should
                      keep working even when the submission window is shut — those people sign in with that Google
                      account and can submit papers and update their files. Everyone else is still blocked.
                    </>
                  }
                  right={
                    <Toggle
                      checked={props.approvedMailEnabled}
                      onChange={props.setApprovedMailEnabled}
                      disabled={props.savingApprovedMail}
                      label="Toggle approved email list"
                    />
                  }
                />
                <div className="px-5 pb-4 space-y-4">
                  <div>
                    <label htmlFor="approved-mail-ids" className="block text-sm font-medium text-stone-700 mb-1.5">
                      Email addresses
                    </label>
                    <textarea
                      id="approved-mail-ids"
                      value={props.approvedMailIds}
                      onChange={(e) => {
                        props.setApprovedMailIds(e.target.value);
                        props.setApprovedMailMessage(null);
                        props.setApprovedMailError(null);
                      }}
                      disabled={!props.approvedMailEnabled || props.savingApprovedMail}
                      rows={5}
                      spellCheck={false}
                      placeholder={'author@gmail.com\nanother.author@gmail.com'}
                      className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm font-mono bg-white text-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-400 disabled:bg-stone-100 disabled:text-stone-400 disabled:cursor-not-allowed"
                    />
                    <p className="text-xs text-stone-400 mt-1.5">
                      One address per line. Commas and semicolons also work. Matching ignores case and surrounding
                      spaces.
                    </p>
                  </div>

                  {/* Check an address */}
                  <div className="bg-stone-50 rounded-lg p-3.5 border border-stone-100">
                    <label htmlFor="approved-mail-check" className="block text-sm font-medium text-stone-700 mb-1.5">
                      Check an address
                    </label>
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        id="approved-mail-check"
                        type="email"
                        value={props.approvedMailCheck}
                        onChange={(e) => props.setApprovedMailCheck(e.target.value)}
                        placeholder="author@gmail.com"
                        spellCheck={false}
                        className="w-full sm:w-72 rounded-lg border border-stone-200 px-3 py-2 text-sm font-mono bg-white text-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-400"
                      />
                      {(() => {
                        const candidate = props.approvedMailCheck.trim().toLowerCase();
                        if (!candidate) return null;
                        const onList = props.savedApprovedMailIds
                          .split(/[\s,;]+/)
                          .map((v) => v.trim().toLowerCase())
                          .filter(Boolean)
                          .includes(candidate);
                        if (onList && props.approvedMailEnabled) {
                          return (
                            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-green-700">
                              <CheckCircle2 className="w-4 h-4" /> On the saved list and active — this account can submit.
                            </span>
                          );
                        }
                        if (onList) {
                          return (
                            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-amber-700">
                              <Info className="w-4 h-4" /> On the saved list but the toggle is off.
                            </span>
                          );
                        }
                        return (
                          <span className="inline-flex items-center gap-1.5 text-sm font-medium text-red-600">
                            <AlertCircle className="w-4 h-4" /> Not on the saved list. Check for typos and save again.
                          </span>
                        );
                      })()}
                    </div>
                    {props.approvedMailIds !== props.savedApprovedMailIds && (
                      <p className="text-xs text-amber-700 mt-1.5">
                        Unsaved changes — this check is against the last saved list.
                      </p>
                    )}
                  </div>

                  {props.approvedMailEnabled && props.approvedMailIds.trim() === '' && (
                    <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 border border-red-200 rounded-lg text-sm font-medium">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      This is on with no addresses listed — everyone stays blocked. Add at least one address or turn it off.
                    </div>
                  )}

                  {props.approvedMailError && (
                    <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 border border-red-200 rounded-lg text-sm font-medium">
                      <AlertCircle className="w-4 h-4 shrink-0" /> {props.approvedMailError}
                    </div>
                  )}
                  {props.approvedMailMessage && (
                    <div className="flex items-center gap-2 p-3 bg-green-50 text-green-700 border border-green-200 rounded-lg text-sm font-medium">
                      <CheckCircle2 className="w-4 h-4 shrink-0" /> {props.approvedMailMessage}
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      onClick={props.saveApprovedMailIds}
                      disabled={props.savingApprovedMail}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-stone-900 text-white font-semibold text-sm hover:bg-stone-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                      {props.savingApprovedMail && <Loader2 className="w-4 h-4 animate-spin" />}
                      {props.savingApprovedMail ? 'Saving...' : 'Save Approved Emails'}
                    </button>
                    <StatusPill
                      active={props.approvedMailEnabled}
                      activeText={`${props.approvedMailIds.split(/[\s,;]+/).filter(Boolean).length} address(es) exempt`}
                      inactiveText="Off — has no effect"
                    />
                    <StatusPill
                      active={props.paperAcceptanceEnabled && !props.mtUserEnabled}
                      activeText="Submissions open to everyone"
                      inactiveText="Submissions closed to everyone else"
                    />
                  </div>
                </div>
              </SettingCard>

              {/* Payment form access */}
              <SettingCard>
                <CardHeader
                  title="Payment form access"
                  description="Add paper titles to grant payment form access to specific authors. Enter a paper title to look up its submission ID, author email, and Clerk ID."
                  right={
                    props.registrationOpen ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                        <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                        Disabled (Registration Open)
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        Active (Manual Approval Mode)
                      </span>
                    )
                  }
                />
                <div className="px-5 pb-6 space-y-5">
                  {props.registrationOpen && (
                    <div className="flex items-start gap-3 p-3.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs sm:text-sm">
                      <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold text-amber-950">
                          Ready for Registration is currently turned ON
                        </p>
                        <p className="mt-0.5 text-amber-800 text-xs leading-relaxed">
                          All authors whose papers are accepted currently have access to the payment form automatically in their portal. Manual paper title approval is disabled while registration is open to everyone. Turn off &quot;Ready for Registration&quot; in the Submissions tab to activate manual paper title approval.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Input field + Add button */}
                  <div className="space-y-2">
                    <label className="block text-xs font-semibold uppercase tracking-wider text-stone-500">
                      Enter Paper Title
                    </label>
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <input
                          type="text"
                          value={newPaperTitle}
                          disabled={props.registrationOpen || addingGrant}
                          onChange={(e) => {
                            setNewPaperTitle(e.target.value);
                            setGrantError(null);
                            setGrantSuccess(null);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !props.registrationOpen) {
                              e.preventDefault();
                              handleAddPaymentAccess();
                            }
                          }}
                          placeholder={
                            props.registrationOpen
                              ? 'Disabled — registration is open to all accepted authors'
                              : 'Enter paper title (or select from list)'
                          }
                          list="submissions-title-list"
                          className="w-full rounded-lg border border-stone-200 px-3.5 py-2.5 text-sm bg-white text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-400 focus:border-stone-400 disabled:bg-stone-100 disabled:text-stone-400 disabled:cursor-not-allowed"
                        />
                        {props.submissions && props.submissions.length > 0 && (
                          <datalist id="submissions-title-list">
                            {props.submissions.map((s: any) => (
                              <option key={s.id} value={s.title}>
                                {s.paper_id ? `[${s.paper_id}] ` : ''}{s.title}
                              </option>
                            ))}
                          </datalist>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={handleAddPaymentAccess}
                        disabled={props.registrationOpen || addingGrant || !newPaperTitle.trim()}
                        className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-stone-900 text-white font-medium hover:bg-stone-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all gap-1 shrink-0 shadow-sm"
                        title={props.registrationOpen ? 'Registration is open to all accepted papers' : 'Grant payment access'}
                      >
                        {addingGrant ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Plus className="w-5 h-5" />
                        )}
                      </button>
                    </div>

                    {grantError && (
                      <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 border border-red-200 rounded-lg text-xs font-medium">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <span>{grantError}</span>
                      </div>
                    )}

                    {grantSuccess && (
                      <div className="flex items-center gap-2 p-3 bg-green-50 text-green-800 border border-green-200 rounded-lg text-xs font-medium">
                        <CheckCircle2 className="w-4 h-4 shrink-0 text-green-600" />
                        <div className="flex-1">
                          <span className="font-semibold">Payment access approved!</span>{' '}
                          <span className="text-green-700">{grantSuccess}</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Approved Paper Box */}
                  <div className="rounded-xl border border-stone-200 bg-stone-50/70 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FileCheck className="w-4 h-4 text-emerald-600" />
                        <h5 className="text-sm font-bold text-stone-900">Approved Paper</h5>
                        <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-stone-200 text-stone-700">
                          {paymentGrants.length}
                        </span>
                      </div>
                      {loadingGrants && (
                        <span className="inline-flex items-center gap-1.5 text-xs text-stone-500">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Refreshing...
                        </span>
                      )}
                    </div>

                    {paymentGrants.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-stone-300 bg-white p-6 text-center">
                        <Shield className="w-6 h-6 text-stone-300 mx-auto mb-1.5" />
                        <p className="text-xs font-medium text-stone-600">No approved papers yet</p>
                        <p className="text-[11px] text-stone-400 mt-0.5">
                          Enter a paper title above and click + to grant payment form access.
                        </p>
                      </div>
                    ) : (
                      <div className="divide-y divide-stone-200 rounded-lg border border-stone-200 bg-white overflow-hidden shadow-sm">
                        {paymentGrants.map((grant) => (
                          <div
                            key={grant.id}
                            className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-stone-50/80 transition-colors"
                          >
                            <div className="min-w-0 space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-bold text-stone-900 break-words">
                                  {grant.paper_title}
                                </span>
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide bg-emerald-100 text-emerald-800 border border-emerald-200">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Payment Access Approved
                                </span>
                              </div>

                              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-stone-500">
                                {grant.paper_id && (
                                  <span className="inline-flex items-center gap-1">
                                    <span className="font-semibold text-stone-700">Paper ID:</span>
                                    <code className="bg-stone-100 px-1 py-0.5 rounded font-mono text-[11px] text-stone-800">
                                      {grant.paper_id}
                                    </code>
                                  </span>
                                )}
                                {grant.submission_id && (
                                  <span className="inline-flex items-center gap-1">
                                    <span className="font-semibold text-stone-700">Submission ID:</span>
                                    <code className="bg-stone-100 px-1 py-0.5 rounded font-mono text-[11px] text-stone-800" title={grant.submission_id}>
                                      {grant.submission_id.length > 12 ? `${grant.submission_id.slice(0, 8)}...` : grant.submission_id}
                                    </code>
                                  </span>
                                )}
                                {grant.author_email && (
                                  <span className="inline-flex items-center gap-1">
                                    <span className="font-semibold text-stone-700">Email:</span>
                                    <span className="text-stone-800">{grant.author_email}</span>
                                  </span>
                                )}
                                <span className="inline-flex items-center gap-1">
                                  <span className="font-semibold text-stone-700">Clerk ID:</span>
                                  {grant.clerk_id ? (
                                    <code className="bg-stone-100 px-1 py-0.5 rounded font-mono text-[11px] text-stone-800">
                                      {grant.clerk_id}
                                    </code>
                                  ) : (
                                    <span className="text-stone-400 italic">Not linked</span>
                                  )}
                                </span>
                              </div>
                            </div>

                            <div className="shrink-0 flex items-center justify-end">
                              <button
                                type="button"
                                onClick={() => handleRevokePaymentAccess(grant.id)}
                                disabled={revokingId === grant.id}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 text-xs font-medium transition-colors disabled:opacity-50"
                                title="Revoke payment access"
                              >
                                {revokingId === grant.id ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Trash2 className="w-3.5 h-3.5" />
                                )}
                                <span>Revoke</span>
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </SettingCard>
            </>
          )}

          {/* ==================== MAINTENANCE ==================== */}
          {section === 'maintenance' && (
            <>
              <div className="mb-1">
                <h4 className="text-lg font-serif font-bold text-stone-900">Portal Maintenance</h4>
                <p className="text-sm text-stone-500 mt-0.5">
                  Take portals offline for maintenance. Visitors see the end date/time you set.
                  Leave the date/time blank for maintenance with no scheduled end.
                </p>
              </div>

              {/* User Portal Maintenance */}
              <SettingCard>
                <CardHeader
                  title="User Portal Maintenance"
                  description="A portal-wide outage switch: when on, users cannot create or update submissions and see a maintenance message. Independent of Accepting Paper Submissions and Allow File Edits."
                  right={
                    <Toggle
                      checked={props.mtUserEnabled}
                      onChange={props.setMtUserEnabled}
                      disabled={props.savingSettings}
                      label="Toggle user portal maintenance"
                    />
                  }
                />
                <div className="px-5 pb-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="text-sm font-medium text-stone-600">Resume date & time</label>
                    <input
                      type="datetime-local"
                      value={props.mtUserUntil}
                      disabled={props.savingSettings}
                      onChange={(e) => props.setMtUserUntil(e.target.value)}
                      className="px-3 py-1.5 rounded-lg border border-stone-200 bg-white text-sm shadow-sm focus:border-stone-400 focus:ring-2 focus:ring-stone-300/40 outline-none transition-all"
                    />
                    {props.mtUserUntil && (
                      <span className="text-xs text-stone-400">
                        Shown as "back online {new Date(props.mtUserUntil).toLocaleString()}"
                      </span>
                    )}
                  </div>
                </div>
                <CardFooter>
                  <StatusPill
                    active={!props.mtUserEnabled}
                    activeText="User portal online"
                    inactiveText="User portal in maintenance"
                  />
                </CardFooter>
              </SettingCard>

              {/* Reviewer Portal Maintenance */}
              <SettingCard>
                <CardHeader
                  title="Reviewer Portal Maintenance"
                  description="When on, reviewers cannot sign in and see a maintenance message."
                  right={
                    <Toggle
                      checked={props.mtReviewEnabled}
                      onChange={props.setMtReviewEnabled}
                      disabled={props.savingSettings}
                      label="Toggle reviewer portal maintenance"
                    />
                  }
                />
                <div className="px-5 pb-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="text-sm font-medium text-stone-600">Resume date & time</label>
                    <input
                      type="datetime-local"
                      value={props.mtReviewUntil}
                      disabled={props.savingSettings}
                      onChange={(e) => props.setMtReviewUntil(e.target.value)}
                      className="px-3 py-1.5 rounded-lg border border-stone-200 bg-white text-sm shadow-sm focus:border-stone-400 focus:ring-2 focus:ring-stone-300/40 outline-none transition-all"
                    />
                    {props.mtReviewUntil && (
                      <span className="text-xs text-stone-400">
                        Shown as "back online {new Date(props.mtReviewUntil).toLocaleString()}"
                      </span>
                    )}
                  </div>
                </div>
                <CardFooter>
                  <StatusPill
                    active={!props.mtReviewEnabled}
                    activeText="Reviewer portal online"
                    inactiveText="Reviewer portal in maintenance"
                  />
                </CardFooter>
              </SettingCard>

              {/* Save button */}
              <div className="flex items-center justify-end pt-2">
                <button
                  onClick={props.savePortalSettings}
                  disabled={props.savingSettings}
                  className="inline-flex items-center gap-2 px-6 py-2.5 bg-stone-900 text-white rounded-xl text-sm font-semibold hover:bg-stone-800 transition-all disabled:opacity-50 shadow-md"
                >
                  {props.savingSettings && <Loader2 className="w-4 h-4 animate-spin" />}
                  {props.savingSettings ? 'Saving...' : 'Save Maintenance Settings'}
                </button>
              </div>
            </>
          )}

          {/* ==================== MAIL TEMPLATES ==================== */}
          {section === 'templates' && (
            <>
              <div className="flex items-center justify-between mb-1">
                <div>
                  <h4 className="text-lg font-serif font-bold text-stone-900">Mail Templates</h4>
                  <p className="text-sm text-stone-500 mt-0.5">
                    Templates used when sending emails to authors from the Reviewed / Needs Revisions sections
                  </p>
                </div>
                <button
                  onClick={() => props.setTemplateDraft({ id: '', name: '', subject: '', body: '' })}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-stone-900 text-white rounded-lg text-sm font-medium hover:bg-stone-800 transition-all shrink-0 shadow-sm"
                >
                  <MailPlus className="w-4 h-4" /> New Template
                </button>
              </div>

              {/* Placeholders info */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm">
                <p className="text-blue-800 font-medium mb-1.5">Available placeholders:</p>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-blue-700">
                  <span>
                    <code className="bg-blue-100 px-1.5 py-0.5 rounded text-blue-900 font-semibold text-xs">{'{name}'}</code>{' '}
                    → primary author
                  </span>
                  <span>
                    <code className="bg-blue-100 px-1.5 py-0.5 rounded text-blue-900 font-semibold text-xs">{'{paper_title}'}</code>{' '}
                    → paper title
                  </span>
                  <span>
                    <code className="bg-blue-100 px-1.5 py-0.5 rounded text-blue-900 font-semibold text-xs">{'{paper_id}'}</code>{' '}
                    → paper ID
                  </span>
                </div>
              </div>

              {props.mailTemplatesError && (
                <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 border border-red-200 rounded-lg text-sm font-medium">
                  <AlertCircle className="w-4 h-4 shrink-0" /> {props.mailTemplatesError}
                </div>
              )}

              {/* Template editor */}
              {props.templateDraft && (
                <SettingCard className="border-stone-300">
                  <div className="px-5 py-4 border-b border-stone-100 bg-stone-50">
                    <h5 className="font-semibold text-stone-900">{props.templateDraft.id ? 'Edit Template' : 'New Template'}</h5>
                  </div>
                  <div className="px-5 py-4 space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-stone-700 mb-1">Template Name</label>
                      <input
                        value={props.templateDraft.name}
                        onChange={(e) => props.setTemplateDraft((d) => d ? { ...d, name: e.target.value } : d)}
                        placeholder="e.g. Accepted paper intimation"
                        className="w-full px-3 py-2 rounded-lg border border-stone-200 bg-white text-sm shadow-sm focus:border-stone-400 focus:ring-2 focus:ring-stone-300/40 outline-none transition-all"
                      />
                    </div>
                    <MailField
                      label="Subject"
                      value={props.templateDraft.subject}
                      onChange={(v) => props.setTemplateDraft((d) => (d ? { ...d, subject: v } : d))}
                      placeholder="e.g. Regarding your paper {paper_title}"
                    />
                    <MailField
                      label="Body"
                      rows={8}
                      value={props.templateDraft.body}
                      onChange={(v) => props.setTemplateDraft((d) => (d ? { ...d, body: v } : d))}
                      placeholder={'Dear {name},\n\nYour paper "{paper_title}" has been...'}
                      help="Formatting buttons and Ctrl+B / Ctrl+I / Ctrl+U / Ctrl+K insert tags like <b> and <link> which render as bold text, italics, or clickable links."
                    />
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        onClick={() => props.saveMailTemplate(props.templateDraft!)}
                        disabled={props.savingTemplate}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-stone-900 text-white rounded-lg text-sm font-medium hover:bg-stone-800 transition-all disabled:opacity-50"
                      >
                        {props.savingTemplate ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                        {props.savingTemplate ? 'Saving...' : 'Save Template'}
                      </button>
                      <button
                        onClick={() => props.setTemplateDraft(null)}
                        disabled={props.savingTemplate}
                        className="px-4 py-2 text-sm font-medium text-stone-600 rounded-lg border border-stone-200 hover:bg-stone-50 transition-colors disabled:opacity-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </SettingCard>
              )}

              {/* Template list */}
              <SettingCard>
                <div className="divide-y divide-stone-100">
                  {props.mailTemplatesLoading ? (
                    <div className="px-5 py-8 text-center text-stone-500 flex flex-col items-center gap-2">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span className="text-sm">Loading templates...</span>
                    </div>
                  ) : props.mailTemplates.length === 0 ? (
                    <div className="px-5 py-8 text-center">
                      <Mail className="w-8 h-8 text-stone-300 mx-auto mb-2" />
                      <p className="text-sm text-stone-500">No mail templates yet. Create one to send emails to authors.</p>
                    </div>
                  ) : (
                    props.mailTemplates.map((t) => (
                      <div key={t.id} className="px-5 py-4 flex items-start justify-between gap-4 hover:bg-stone-50 transition-colors">
                        <div className="min-w-0">
                          <h5 className="font-semibold text-stone-900">{t.name}</h5>
                          <p className="text-xs text-stone-400 font-medium mt-0.5 break-words">{t.subject}</p>
                          <p className="text-sm text-stone-600 mt-1.5 whitespace-pre-wrap break-words line-clamp-2">{t.body}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => props.setTemplateDraft({ id: t.id, name: t.name, subject: t.subject, body: t.body })}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-stone-700 rounded-lg border border-stone-200 hover:bg-stone-100 transition-colors"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => props.deleteMailTemplate(t.id)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-red-600 rounded-lg border border-red-200 hover:bg-red-50 transition-colors"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </SettingCard>
            </>
          )}

          {/* ==================== DATA & BACKUP ==================== */}
          {section === 'data' && (
            <>
              <div className="mb-1">
                <h4 className="text-lg font-serif font-bold text-stone-900">Data & Backup</h4>
                <p className="text-sm text-stone-500 mt-0.5">Download backups and manage registration configuration</p>
              </div>

              {/* Full Backup */}
              <SettingCard>
                <div className="flex items-start justify-between gap-4 px-5 py-5">
                  <div>
                    <div className="flex items-center gap-2.5 mb-1.5">
                      <div className="w-8 h-8 rounded-lg bg-stone-100 flex items-center justify-center">
                        <Download className="w-4 h-4 text-stone-600" />
                      </div>
                      <h4 className="font-semibold text-stone-900 text-[15px]">Full Backup / Download</h4>
                    </div>
                    <p className="text-sm text-stone-500 leading-relaxed">
                      Download a complete snapshot of all data (every table, plus the record of stored paper files) as a
                      single JSON file saved straight to your computer. The backup is generated on demand, is never stored
                      in the database, and is deleted from our servers the moment it leaves.
                    </p>
                  </div>
                  <button
                    onClick={props.downloadBackup}
                    disabled={props.backingUp}
                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-stone-900 text-white rounded-lg text-sm font-medium hover:bg-stone-800 transition-all shrink-0 disabled:opacity-50 shadow-sm"
                  >
                    {props.backingUp ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                    {props.backingUp ? 'Creating...' : 'Download Backup'}
                  </button>
                </div>
                {props.backupError && (
                  <div className="px-5 py-3 text-sm text-red-700 flex items-center gap-2 bg-red-50 border-t border-red-200">
                    <AlertCircle className="w-4 h-4 shrink-0" /> {props.backupError}
                  </div>
                )}
                {props.backupMessage && (
                  <div className="px-5 py-3 text-sm text-green-700 flex items-center gap-2 bg-green-50 border-t border-green-200">
                    <CheckCircle2 className="w-4 h-4 shrink-0" /> {props.backupMessage}
                  </div>
                )}
              </SettingCard>

              {/* Registration Fees & Bank Details */}
              <div className="mt-6">
                <div className="mb-4">
                  <h4 className="text-lg font-serif font-bold text-stone-900">Registration Fees & Bank Details</h4>
                  <p className="text-sm text-stone-500 mt-0.5">
                    These values are shown to authors in their payment form. Each fee row is also an option authors can
                    choose, so adding a row adds a choice to the user portal. Changes take effect for authors as soon as
                    you save.
                  </p>
                </div>
                <RegistrationConfigPanel
                  config={props.registrationConfig}
                  onChange={props.setRegistrationConfig}
                />
                {props.error && (
                  <div className="mt-4 flex items-center gap-2 p-3 bg-red-50 text-red-700 border border-red-200 rounded-xl text-sm font-medium">
                    <AlertCircle className="w-4 h-4 shrink-0 text-red-600" /> {props.error}
                  </div>
                )}
                <div className="flex items-center justify-end mt-5">
                  <button
                    onClick={props.savePortalSettings}
                    disabled={props.savingSettings}
                    className="inline-flex items-center gap-2 px-6 py-2.5 bg-stone-900 text-white rounded-xl text-sm font-semibold hover:bg-stone-800 transition-all disabled:opacity-50 shadow-md"
                  >
                    {props.savingSettings && <Loader2 className="w-4 h-4 animate-spin" />}
                    {props.savingSettings ? 'Saving...' : 'Save Fees & Bank Details'}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

