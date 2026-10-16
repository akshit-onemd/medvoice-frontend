import React from "react";
import { RotateCcw } from "lucide-react";

export default function DraftBanner({ draft }) {
    if (!draft?.restored) return null;
    return (
        <div className="mb-4 flex items-center gap-3 rounded border border-clinical-500 bg-clinical-50 px-3 py-2 text-xs text-ink">
            <RotateCcw
                size={14}
                strokeWidth={1.75}
                className="shrink-0 text-clinical-600"
            />
            <span className="flex-1">Restored your unsaved entries.</span>
            <button
                type="button"
                onClick={draft.discard}
                className="text-alert-500 underline underline-offset-2"
            >
                Discard
            </button>
            <button
                type="button"
                onClick={draft.dismiss}
                className="text-muted underline underline-offset-2"
            >
                Keep
            </button>
        </div>
    );
}
