import React from 'react';
import { ArrowRight } from 'lucide-react';
import wileyLogo from '../../assets/images/WILEY(BLACK).png';
import scopusLogo from '../../assets/images/scopus.png';
import snsctLogo from '../../assets/images/SNSCT.png';

export function HeroSection({ onStart }: { onStart: () => void }) {
  return (
    <div className="relative overflow-hidden">
      {/* Announcement Banner */}
      <div className="w-full bg-[#000000] border-y border-[#000000] py-2.5 overflow-hidden z-40">
        <div className="flex w-max animate-marquee items-center gap-12 px-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex items-center gap-12 whitespace-nowrap">
              <span className="text-[#FFFFFF] font-times font-semi-bold uppercase tracking-widest text-[16px] md:text-xs[6px]">Publishing Partner</span>
              <img src={wileyLogo} alt="Wiley" className="h-10 md:h-12 object-contain" />
              <span className="text-[#FFFFFF]">|</span>
              <span className="text-[#FFFFFF] font-times font-semi-bold uppercase tracking-widest text-[16px] md:text-xs[6px]">Indexed In</span>
              <img src={scopusLogo} alt="Scopus" className="h-10 md:h-12 object-contain" />
              <span className="text-[#FFFFFF]">|</span>
              <span className="text-[#FFFFFF] font-times font-semi-bold uppercase tracking-widest text-[16px] md:text-xs[6px]">November 20<sup className="lowercase">th</sup> & 21<sup className="lowercase">st</sup> 2026</span>
              <span className="text-[#FFFFFF]">|</span>
              <div className="flex items-center gap-2">
                <img src={snsctLogo} alt="SNSCT" className="h-6 md:h-8 object-contain" />
                <span className="text-[#FFFFFF] font-times font-semi-bold uppercase tracking-widest text-[16px] md:text-xs[6px]">SNS College Of Technology</span>
              </div>
              <span className="text-[#FFFFFF]">|</span>
            </div>
          ))}
        </div>
      </div>
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
