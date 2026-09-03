import React, { useState } from 'react';
import { FileUp, CheckCircle, ChevronRight, UserPlus, Upload } from 'lucide-react';

export function SubmissionWizard({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState(1);

  const handleNext = (e: React.FormEvent) => {
    e.preventDefault();
    if (step < 3) setStep(step + 1);
    else onComplete();
  };

  return (
    <div className="container mx-auto px-4 py-12 max-w-4xl">
      <div className="mb-12">
        <h1 className="text-4xl font-serif font-bold mb-4">Submit Your Paper</h1>
        <p className="text-brand-text/70 text-lg">
          Complete the steps below to submit your research to ICAIDIET'26.
        </p>
      </div>

      <div className="flex gap-4 mb-8">
        {[1, 2, 3].map((num) => (
          <div key={num} className="flex-1">
            <div className={`h-2 rounded-full mb-2 transition-colors ${
              step >= num ? 'bg-brand-accent' : 'bg-brand-text/10'
            }`} />
            <span className={`text-sm font-medium ${
              step >= num ? 'text-brand-accent' : 'text-brand-text/40'
            }`}>
              Step {num}: {num === 1 ? 'Details' : num === 2 ? 'Authors' : 'Upload'}
            </span>
          </div>
        ))}
      </div>

      <div className="bg-brand-card rounded-2xl p-8 shadow-xl border border-brand-text/5">
        <form onSubmit={handleNext}>
          {step === 1 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <h2 className="text-2xl font-serif font-bold mb-6 flex items-center gap-2">
                <FileUp className="w-6 h-6 text-brand-accent" />
                Paper Details
              </h2>
              
              <div>
                <label className="block text-sm font-medium mb-1">Paper ID</label>
                <input 
                  required type="text" 
                  className="w-full px-4 py-3 rounded-xl bg-white/90 border-transparent focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/20 outline-none transition-all text-lg"
                  placeholder="Your paper ID From CMT portal"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Paper Title</label>
                <input 
                  required type="text" 
                  className="w-full px-4 py-3 rounded-xl bg-white/90 border-transparent focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/20 outline-none transition-all text-lg"
                  placeholder="e.g. Advancements in Deep Learning for Healthcare"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Abstract</label>
                <textarea 
                  required rows={5}
                  className="w-full px-4 py-3 rounded-xl bg-white/90 border-transparent focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/20 outline-none transition-all resize-none"
                  placeholder="Provide a  summary of your research..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Conference Track</label>
                <select required className="w-full px-4 py-3 rounded-xl bg-white/90 border-transparent focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/20 outline-none transition-all">
                  <option value="">Select a track</option>
                  <option value="ai-intelligent-systems">Artificial Intelligence & Intelligent Systems</option>
                  <option value="ml-advanced-analytics">Machine Learning & Advanced Analytics</option>
                  <option value="data-science-decision-intelligence">Data Science & Decision Intelligence</option>
                  <option value="iot-edge-embedded">IoT, Edge Computing & Embedded Systems</option>
                  <option value="communication-network">Communication Systems & Network Technologies</option>
                  <option value="cybersecurity">Cybersecurity & Secure Computing</option>
                  <option value="robotics-automation">Robotics, Automation & Smart Industry</option>
                  <option value="emerging-tech-sustainability">Emerging Technologies, Sustainability & AI Management</option>
                </select>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <h2 className="text-2xl font-serif font-bold mb-6 flex items-center gap-2">
                <UserPlus className="w-6 h-6 text-brand-accent" />
                Authors
              </h2>
              <p className="text-sm text-brand-text/70 mb-4">Add all contributing authors. You will be listed as the primary author.</p>
              
              <div className="space-y-4">
                {/* Author 1 (Primary) */}
                <div className="flex gap-4 items-center bg-white/50 p-4 rounded-xl border border-white/40">
                  <div className="flex-1 grid grid-cols-2 gap-4">
                    <input type="text" placeholder="First Name" required className="px-4 py-2 rounded-lg bg-white outline-none" />
                    <input type="text" placeholder="Last Name" required className="px-4 py-2 rounded-lg bg-white outline-none" />
                    <input type="email" placeholder="Email Address" required className="col-span-2 px-4 py-2 rounded-lg bg-white outline-none" />
                  </div>
                </div>
              </div>

              <button type="button" className="text-brand-accent text-sm font-medium hover:underline flex items-center gap-1 mt-4">
                <UserPlus className="w-4 h-4" /> Add another author
              </button>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <h2 className="text-2xl font-serif font-bold mb-6 flex items-center gap-2">
                <Upload className="w-6 h-6 text-brand-accent" />
                Upload Manuscript
              </h2>
              
              <div className="border-2 border-dashed border-brand-accent/40 rounded-2xl p-12 text-center bg-brand-accent/5 hover:bg-brand-accent/10 transition-colors cursor-pointer group">
                <div className="bg-white w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm group-hover:scale-110 transition-transform">
                  <Upload className="w-8 h-8 text-brand-accent" />
                </div>
                <h3 className="text-xl font-bold mb-2">Click to upload or drag and drop</h3>
                <p className="text-sm text-brand-text/60">PDF format only. Maximum file size 10MB.</p>
                <input type="file" accept=".pdf" className="hidden" id="file-upload" />
              </div>
              
              <div className="flex items-center gap-2 text-sm text-brand-text/70 bg-white/50 p-4 rounded-lg">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <span>I confirm that this submission complies with the IEEE formatting guidelines.</span>
              </div>
            </div>
          )}

          <div className="flex justify-between mt-10 pt-6 border-t border-brand-text/10">
            {step > 1 ? (
              <button 
                type="button" 
                onClick={() => setStep(step - 1)}
                className="px-6 py-3 rounded-xl font-medium text-brand-text hover:bg-brand-text/5 transition-colors"
              >
                Back
              </button>
            ) : (
              <div />
            )}
            
            <button 
              type="submit"
              className="bg-brand-text text-white px-8 py-3 rounded-xl font-medium hover:bg-brand-accent hover:-translate-y-0.5 transition-all shadow-lg flex items-center gap-2"
            >
              {step === 3 ? 'Submit Paper' : 'Continue'}
              {step !== 3 && <ChevronRight className="w-4 h-4" />}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
