import type { ReactNode } from 'react';
import { Show, SignInButton, UserButton } from '@clerk/react';
import wileyLogoBlack from '../../assets/images/WILEY(BLACK).png';
import scopusLogo from '../../assets/images/scopus.png';
import snsctLogo from '../../assets/images/SNSCT.png';

type NavView = 'home' | 'wizard' | 'submissions';

interface MainLayoutProps {
  children: ReactNode;
  view?: NavView;
  onNavigate?: (view: NavView) => void;
  maintenanceMode?: boolean;
}

const NAV_ITEMS: { view: NavView; label: string }[] = [
  { view: 'home', label: 'Home' },
  { view: 'wizard', label: 'Submit Paper' },
  { view: 'submissions', label: 'My Submissions' },
];

export function MainLayout({ children, view, onNavigate, maintenanceMode }: MainLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col font-sans text-brand-text bg-brand-bg">
      {maintenanceMode && (
        <div className="bg-red-600 text-white text-center py-3 px-4 shadow-md font-semibold text-sm sm:text-base z-[60] relative">
          The portal is under maintenance. We will be live on September 11, 2026, at 6:00 PM.
        </div>
      )}
      <header className="sticky top-0 z-50 w-full backdrop-blur-md bg-brand-bg/80 border-b border-brand-text/10 flex flex-col">
        {/* Row 1: Logo */}
        <div className="container mx-auto px-4 h-16 flex-shrink-0 flex items-center">
          <button
            onClick={() => onNavigate?.('home')}
            className="font-serif font-bold text-xl tracking-tight"
          >
            ICAIDIET&apos;26
          </button>
        </div>

        {/* Row 2: Announcement Banner */}
        <div className="w-full bg-[#000000] border-y border-[#000000] py-2.5 overflow-hidden z-40">
          <div className="flex w-max animate-marquee items-center gap-12 px-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex items-center gap-12 whitespace-nowrap">
                <span className="text-[#FFFFFF] font-times font-semibold uppercase tracking-widest text-[16px]">Publishing Partner</span>
                <img src={wileyLogoBlack} alt="Wiley" className="h-10 md:h-12 object-contain" />
                <span className="text-[#FFFFFF]">|</span>
                <span className="text-[#FFFFFF] font-times font-semibold uppercase tracking-widest text-[16px]">Indexed In</span>
                <img src={scopusLogo} alt="Scopus" className="h-10 md:h-12 object-contain" />
                <span className="text-[#FFFFFF]">|</span>
                <span className="text-[#FFFFFF] font-times font-semibold uppercase tracking-widest text-[16px]">November 20<sup className="lowercase">th</sup> & 21<sup className="lowercase">st</sup> 2026</span>
                <span className="text-[#FFFFFF]">|</span>
                <div className="flex items-center gap-2">
                  <img src={snsctLogo} alt="SNSCT" className="h-6 md:h-8 object-contain" />
                  <span className="text-[#FFFFFF] font-times font-semibold uppercase tracking-widest text-[16px]">SNS College Of Technology</span>
                </div>
                <span className="text-[#FFFFFF]">|</span>
              </div>
            ))}
          </div>
        </div>

        {/* Row 3: Navigation and Profile */}
        <div className="container mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-y-3">
          <div className="flex items-center gap-2 overflow-x-auto">
            <Show when="signed-in">
              {NAV_ITEMS.map((item) => (
                <button
                  key={item.view}
                  onClick={() => onNavigate?.(item.view)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${view === item.view
                      ? 'bg-brand-text text-white'
                      : 'hover:bg-brand-text/10'
                    }`}
                >
                  {item.label}
                </button>
              ))}
            </Show>
          </div>

          <div className="flex items-center gap-3 ml-4">
            <Show when="signed-out">
              <SignInButton mode="modal">
                <button className="px-4 py-2 bg-brand-text text-white rounded-lg text-sm font-medium hover:bg-brand-accent hover:-translate-y-0.5 transition-all shadow whitespace-nowrap">
                  Sign In
                </button>
              </SignInButton>
            </Show>
            <Show when="signed-in">
              <UserButton afterSignOutUrl="/" />
            </Show>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {children}
      </main>

      <footer className="bg-brand-footer text-white py-6">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="text-center md:text-left">
              <h3 className="font-serif text-xl font-bold mb-1">ICAIDIET&apos;26</h3>
              <p className="text-white/70 text-xs">
                International Conference on AI-Driven Innovation in Engineering and Technology
              </p>
            </div>
            <div className="flex flex-col items-center md:items-end gap-3 text-xs text-white/50">
              <div className="text-center md:text-right text-white/70">
                <p className="font-semibold text-white/90 mb-1">For Queries/Assistance</p>
                <p>+91 7358981203</p>
                <p>icaidiet26@gmail.com</p>
              </div>
              <div>
                &copy; 2026 ICAIDIET. All rights reserved.
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}