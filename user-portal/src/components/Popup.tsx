import React from 'react';
import { CheckCircle, AlertCircle, X } from 'lucide-react';

export interface PopupInfo {
  type: 'success' | 'error';
  title: string;
  message: string;
}

interface PopupProps {
  info: PopupInfo;
  onClose: () => void;
}

export function Popup({ info, onClose }: PopupProps) {
  const isSuccess = info.type === 'success';
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div
        className={`relative w-full max-w-md rounded-2xl p-8 shadow-2xl border text-center animate-in zoom-in duration-300 ${
          isSuccess ? 'bg-white border-green-200' : 'bg-white border-red-200'
        }`}
        role="dialog"
        aria-modal="true"
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-stone-400 hover:text-stone-600 transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        <div
          className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${
            isSuccess ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
          }`}
        >
          {isSuccess ? <CheckCircle className="w-9 h-9" /> : <AlertCircle className="w-9 h-9" />}
        </div>

        <h2 className={`font-serif text-2xl font-bold mb-2 ${isSuccess ? 'text-green-800' : 'text-red-800'}`}>
          {info.title}
        </h2>
        <p className="text-stone-600 text-sm whitespace-pre-line mb-6">{info.message}</p>

        <button
          onClick={onClose}
          className={`w-full py-3 rounded-xl font-medium text-white transition-colors ${
            isSuccess ? 'bg-brand-text hover:bg-brand-accent' : 'bg-red-600 hover:bg-red-700'
          }`}
        >
          {isSuccess ? 'Done' : 'Try Again'}
        </button>
      </div>
    </div>
  );
}
