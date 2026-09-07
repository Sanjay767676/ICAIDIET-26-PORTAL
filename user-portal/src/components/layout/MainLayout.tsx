import type { ReactNode } from 'react';
import { Show, SignInButton, UserButton } from '@clerk/react';

type NavView = 'home' | 'wizard' | 'submissions';

interface MainLayoutProps {
  children: ReactNode;
  view?: NavView;
  onNavigate?: (view: NavView) => void;
}

const NAV_ITEMS: { view: NavView; label: string }[] = [
  { view: 'home', label: 'Home' },
  { view: 'wizard', label: 'Submit Paper' },
  { view: 'submissions', label: 'My Submissions' },
];

export function MainLayout({ children, view, onNavigate }: MainLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col font-sans text-brand-text bg-brand-bg">
      <header className="sticky top-0 z-50 w-full backdrop-blur-md bg-brand-bg/80 border-b border-brand-text/10">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <button
            onClick={() => onNavigate?.('home')}
            className="font-serif font-bold text-xl tracking-tight"
          >
            ICAIDIET&apos;26
          </button>

          <div className="flex items-center gap-3">
            <Show when="signed-out">
              <SignInButton mode="modal">
                <button className="px-4 py-2 bg-brand-text text-white rounded-lg text-sm font-medium hover:bg-brand-accent hover:-translate-y-0.5 transition-all shadow">
                  Sign In
                </button>
              </SignInButton>
            </Show>
            <Show when="signed-in">
              <UserButton afterSignOutUrl="/" />
            </Show>
          </div>
        </div>

        <Show when="signed-in">
          <nav className="container mx-auto px-4 pb-3 flex items-center gap-2 overflow-x-auto">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.view}
                onClick={() => onNavigate?.(item.view)}
                className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                  view === item.view
                    ? 'bg-brand-text text-white'
                    : 'hover:bg-brand-text/10'
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>
        </Show>
      </header>

      <main className="flex-1">
        {children}
      </main>

      <footer className="bg-brand-footer text-white py-6">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div>
              <h3 className="font-serif text-xl font-bold mb-1">ICAIDIET&apos;26</h3>
              <p className="text-white/70 text-xs">
                International Conference on AI-Driven Innovation in Engineering and Technology
              </p>
            </div>
            <div className="text-xs text-white/50">
              &copy; 2026 ICAIDIET. All rights reserved.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}