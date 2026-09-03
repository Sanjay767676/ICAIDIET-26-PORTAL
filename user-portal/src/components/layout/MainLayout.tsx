import React from 'react';

interface MainLayoutProps {
  children: React.ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col font-sans text-brand-text bg-brand-bg">
      <header className="sticky top-0 z-50 w-full backdrop-blur-md bg-brand-bg/80 border-b border-brand-text/10">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-serif font-bold text-xl tracking-tight">ICAIDIET'26</span>
          </div>


        </div>
      </header>

      <main className="flex-1">
        {children}
      </main>

      <footer className="bg-brand-footer text-white py-6">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div>
              <h3 className="font-serif text-xl font-bold mb-1">ICAIDIET'26</h3>
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
