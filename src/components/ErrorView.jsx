import React, { useState } from "react";
import {
    AlertTriangle,
    ArrowLeft,
    Check,
    ChevronDown,
    Copy,
    RotateCcw,
} from "lucide-react";

async function copyText(text) {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch {
        /* clipboard blocked on plain HTTP: fall back below */
    }
    try {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.cssText = "position:fixed;opacity:0;top:0;left:0;";
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand("copy");
        ta.remove();
        return ok;
    } catch {
        return false;
    }
}

export default function ErrorView({ info, onRetry, onBack }) {
    const [open, setOpen] = useState(false);
    const [copied, setCopied] = useState(false);
    const transcript = info?.diarizedTranscript || info?.transcript || "";

    const copy = async () => {
        if (await copyText(transcript)) {
            setCopied(true);
            setTimeout(() => setCopied(false), 1800);
        }
    };

    return (
        <div className="mx-auto w-full max-w-2xl">
            <div className="rounded-md border border-line bg-surface p-6 text-center shadow-panel">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-alert-50 text-alert-500">
                    <AlertTriangle size={22} strokeWidth={1.75} />
                </div>
                <h2 className="mt-4 font-serif text-xl text-ink">
                    {info?.message || "Something went wrong. Please try again."}
                </h2>
                <p className="mt-2 text-sm text-muted">
                    Your recording and files are kept on this device.
                    {transcript
                        ? "Try again reuses the transcript."
                        : "Try again sends your recording again."}
                </p>

                <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
                    <button
                        type="button"
                        onClick={onRetry}
                        className="inline-flex items-center justify-center gap-2 rounded bg-clinical-500 px-5 py-2.5 text-sm font-medium text-paper hover:bg-clinical-600"
                    >
                        <RotateCcw size={16} strokeWidth={1.75} />
                        Try again
                    </button>
                    <button
                        type="button"
                        onClick={onBack}
                        className="inline-flex items-center justify-center gap-2 rounded border border-line bg-surface px-5 py-2.5 text-sm text-ink hover:bg-paper"
                    >
                        <ArrowLeft size={16} strokeWidth={1.75} />
                        Go back
                    </button>
                </div>
            </div>

            {transcript && (
                <div className="mt-4 rounded-md border border-line bg-surface shadow-panel">
                    <button
                        type="button"
                        onClick={() => setOpen((v) => !v)}
                        className="flex w-full items-center justify-between px-5 py-3.5 text-left"
                    >
                        <span className="font-serif text-base text-ink">
                            Transcript
                        </span>
                        <ChevronDown
                            size={16}
                            className={`text-muted transition-transform ${open ? "rotate-180" : ""}`}
                        />
                    </button>
                    {open && (
                        <div className="px-5 pb-5">
                            <button
                                type="button"
                                onClick={copy}
                                className="mb-3 inline-flex items-center gap-1.5 rounded border border-line bg-surface px-3 py-1.5 text-xs text-ink hover:bg-paper"
                            >
                                {copied ? (
                                    <Check size={12} />
                                ) : (
                                    <Copy size={12} />
                                )}
                                {copied ? "Copied" : "Copy transcript"}
                            </button>
                            <p className="max-h-72 overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed text-ink/80">
                                {transcript}
                            </p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
