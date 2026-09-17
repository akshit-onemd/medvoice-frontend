import React from "react";
import { AlertTriangle } from "lucide-react";

export default function ErrorView({ message, onRetry }) {
  return (
    <div className="w-full max-w-lg mx-auto">
      <div className="bg-surface border border-alert-400/30 rounded-md shadow-panel p-8 text-center">
        <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-alert-50 text-alert-500">
          <AlertTriangle size={20} strokeWidth={1.75} />
        </div>
        <h2 className="font-serif text-lg text-ink mb-2">Something went wrong</h2>
        <p className="text-sm text-muted mb-6">{message}</p>
        <button
          type="button"
          onClick={onRetry}
          className="rounded bg-ink text-paper px-5 py-2.5 text-sm hover:bg-clinical-700 transition-colors"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
