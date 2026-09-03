import React from 'react';
import { ArrowRight } from 'lucide-react';
import wileyLogoBlack from '../../assets/images/WILEY(BLACK).png';
import scopusLogo from '../../assets/images/scopus.png';
import snsctLogo from '../../assets/images/SNSCT.png';

export function HeroSection({ onStart }: { onStart: () => void }) {
  return (
    <div className="relative overflow-hidden">
      {/* Announcement Banner */}
      <div className="absolute top-0 left-0 w-full bg-[#000000] border-y border-[#000000] py-2.5 overflow-hidden z-40">
        <div className="flex w-max animate-marquee items-center gap-12 px-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex items-center gap-12 whitespace-nowrap">
              <span className="text-[#FFFFFF] font-serif font-semibold uppercase tracking-widest text-[16px]">Publishing Partner</span>
              <img src={wileyLogoBlack} alt="Wiley" className="h-10 md:h-12 object-contain bg-white px-2 py-1 rounded" />
              <span className="text-[#FFFFFF]">|</span>
              <span className="text-[#FFFFFF] font-serif font-semibold uppercase tracking-widest text-[16px]">Indexed In</span>
              <img src={scopusLogo} alt="Scopus" className="h-10 md:h-12 object-contain bg-white px-2 py-1 rounded" />
              <span className="text-[#FFFFFF]">|</span>
              <span className="text-[#FFFFFF] font-serif font-semibold uppercase tracking-widest text-[16px]">November 20<sup className="lowercase">th</sup> & 21<sup className="lowercase">st</sup> 2026</span>
              <span className="text-[#FFFFFF]">|</span>
              <div className="flex items-center gap-2">
                <img src={snsctLogo} alt="SNSCT" className="h-6 md:h-8 object-contain bg-white px-1 py-1 rounded" />
                <span className="text-[#FFFFFF] font-serif font-semibold uppercase tracking-widest text-[16px]">SNS College Of Technology</span>
              </div>
              <span className="text-[#FFFFFF]">|</span>
            </div>
          ))}
        </div>
      </div>

      <div className="container mx-auto px-4 py-32 md:py-40 relative z-10">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-serif font-bold tracking-tight mb-8 leading-tight">
            International Conference on AI-Driven Innovation
            <span className="block mt-2">in Engineering and Technology</span>
          </h1>

          <p className="text-xl md:text-2xl font-serif font-bold text-brand-text/90 mb-4">On</p>
          
          <p className="text-2xl md:text-3xl font-serif font-bold text-brand-text mb-2">
            20<sup>th</sup> & 21<sup>st</sup> November 2026
          </p>
          <p className="text-lg md:text-xl font-serif text-brand-text/80 mb-6">
            (Hybrid Mode)
          </p>
          
          <p className="text-2xl md:text-3xl font-serif font-bold text-brand-text mb-12">
            SNS - AI Campus
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button 
              onClick={onStart}
              className="w-full sm:w-auto px-8 py-4 bg-brand-text text-white rounded-xl font-semibold text-lg hover:bg-brand-accent hover:-translate-y-1 transition-all shadow-xl hover:shadow-brand-accent/25 flex items-center justify-center gap-2 group"
            >
              Go to Submission Portal
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
            <button className="w-full sm:w-auto px-8 py-4 bg-white/50 backdrop-blur-sm border border-brand-text/10 text-brand-text rounded-xl font-semibold text-lg hover:bg-white transition-all">
              Author Guidelines
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
