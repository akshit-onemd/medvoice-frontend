import React from "react";
import { Check, Loader2 } from "lucide-react";
import { PROCESSING_STAGES } from "../api/processAudio";

export default function ProcessingView({ currentStage }) {
  return (
    <div className="w-full max-w-lg mx-auto">
      <div className="bg-surface border border-line rounded-md shadow-panel p-6 sm:p-8 mt-4 sm:mt-10">
        <ol className="space-y-0">
          {PROCESSING_STAGES.map((stage, index) => {
            const isDone = index < currentStage;
            const isActive = index === currentStage;
            const isLast = index === PROCESSING_STAGES.length - 1;

            return (
              <li key={stage.key} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs transition-colors ${
                      isDone
                        ? "bg-clinical-500 border-clinical-500 text-paper"
                        : isActive
                        ? "border-clinical-500 text-clinical-500"
                        : "border-line text-muted"
                    }`}
                  >
                    {isDone ? (
                      <Check size={14} strokeWidth={2} />
                    ) : isActive ? (
                      <Loader2 size={14} strokeWidth={2} className="animate-spin" />
                    ) : (
                      <span>{index + 1}</span>
                    )}
                  </div>
                  {!isLast && (
                    <div
                      className={`w-px flex-1 min-h-[28px] ${
                        isDone ? "bg-clinical-500" : "bg-line"
                      }`}
                    />
                  )}
                </div>
                <div className={isLast ? "" : "pb-7"}>
                  <p
                    className={`text-sm ${
                      isActive ? "text-ink font-medium" : isDone ? "text-ink" : "text-muted"
                    }`}
                  >
                    {stage.label}
                  </p>
                  {isActive && (
                    <p className="text-xs text-muted mt-0.5">This can take a little while.</p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
