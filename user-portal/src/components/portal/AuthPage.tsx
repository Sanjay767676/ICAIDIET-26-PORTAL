import React, { useState } from 'react';

export function AuthPage({ onLogin }: { onLogin: () => void }) {
  const [isLogin, setIsLogin] = useState(true);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onLogin();
  };

  return (
    <div className="flex-1 flex items-center justify-center p-4 py-20">
      <div className="bg-brand-card w-full max-w-md rounded-2xl p-8 shadow-xl border border-brand-text/5">
        <div className="text-center mb-8">
          <h2 className="font-serif text-3xl font-bold mb-2">
            {isLogin ? 'Welcome Back' : 'Create Account'}
          </h2>
          <p className="text-brand-text/70 text-sm">
            {isLogin 
              ? 'Sign in to manage your paper submissions' 
              : 'Register to submit a paper to ICAIDIET\'26'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <div>
              <label className="block text-sm font-medium mb-1">Full Name</label>
              <input 
                type="text" 
                required
                className="w-full px-4 py-2 rounded-lg bg-white/90 border-transparent focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/20 outline-none transition-all"
                placeholder="Dr. Jane Doe"
              />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium mb-1">Email Address</label>
            <input 
              type="email" 
              required
              className="w-full px-4 py-2 rounded-lg bg-white/90 border-transparent focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/20 outline-none transition-all"
              placeholder="jane@university.edu"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Password</label>
            <input 
              type="password" 
              required
              className="w-full px-4 py-2 rounded-lg bg-white/90 border-transparent focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/20 outline-none transition-all"
              placeholder="••••••••"
            />
          </div>

          <button 
            type="submit"
            className="w-full bg-brand-accent text-white py-2.5 rounded-lg font-medium hover:bg-blue-700 hover:shadow-lg hover:-translate-y-0.5 transition-all mt-6"
          >
            {isLogin ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <div className="mt-6 text-center text-sm">
          <button 
            onClick={() => setIsLogin(!isLogin)}
            className="text-brand-text/80 hover:text-brand-accent font-medium transition-colors"
          >
            {isLogin 
              ? "Don't have an account? Register" 
              : "Already have an account? Sign in"}
          </button>
        </div>
      </div>
    </div>
  );
}
