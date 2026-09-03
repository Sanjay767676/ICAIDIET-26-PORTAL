import React from 'react';
import { ArrowRight, Calendar, MapPin } from 'lucide-react';

export function HeroSection({ onStart }: { onStart: () => void }) {
  return (
    <div className="relative overflow-hidden">


      <div className="container mx-auto px-4 py-24 md:py-32 relative z-10">
        <div className="max-w-4xl mx-auto text-center">


          <h1 className="text-5xl md:text-7xl font-serif font-bold tracking-tight mb-6">
            Welcome to{' '}
            <span className="block mt-2">
              ICAIDIET'26
            </span>
          </h1>

          <p className="text-xl md:text-2xl text-brand-text/80 mb-10 max-w-2xl mx-auto font-medium">
            International Conference on AI-Driven Innovation in Engineering and Technology
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-6 mb-12 text-brand-text/70">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-brand-accent" />
              <span>August 15-17, 2026</span>
            </div>
            <div className="hidden sm:block w-1.5 h-1.5 rounded-full bg-brand-text/20" />
            <div className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-brand-accent" />
              <span>Virtual & London, UK</span>
            </div>
          </div>

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
