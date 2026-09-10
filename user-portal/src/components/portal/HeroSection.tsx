import { ArrowRight } from 'lucide-react';
export function HeroSection({ onStart }: { onStart: () => void }) {
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
        {/* Buttons */}

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full max-w-2xl">
          <button
            onClick={onStart}
            className="w-full sm:w-auto px-8 py-4 bg-brand-text text-white rounded-xl font-semibold text-lg hover:bg-brand-accent hover:-translate-y-1 transition-all shadow-xl flex items-center justify-center gap-2 group"
          >
            Go to Submission Portal
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </button>
          <a
            href="https://www.icaidiet26.tech/paper-submission"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full sm:w-auto px-8 py-4 bg-white/50 backdrop-blur-sm border border-brand-text/10 text-brand-text rounded-xl font-semibold text-lg hover:bg-white transition-all text-center"
          >
            Author Guidelines
          </a>
        </div>
      </div>
    </div>
  );
}
