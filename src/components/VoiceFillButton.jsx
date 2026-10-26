import React, { useState } from "react";
import { Loader2, Mic, Square, X } from "lucide-react";
import useVoiceCapture from "../hooks/useVoiceCapture";
import { useDirtyFlag } from "../hooks/useDirty";
import { parseVoice } from "../api/processAudio";
import LiveWaveform from "./LiveWaveform";

const mmss = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

export default function VoiceFillButton({
    section,
    consultationId = "",
    onResult,
    disabled = false,
}) {
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");

    const cap = useVoiceCapture({
        onClip: async (blob) => {
            setBusy(true);
            setError("");
            try {
                onResult(await parseVoice(blob, section, consultationId));
            } catch (err) {
                setError(
                    err.message ||
                        "Couldn't understand the recording. Please try again.",
                );
            } finally {
                setBusy(false);
            }
        },
    });

    useDirtyFlag(cap.recording || busy); // Back warns while recording or processing
    const shownError = error || cap.error;

    return (
        <div>
            {cap.recording ? (
                <div className="flex items-center gap-3 rounded border border-clinical-500 bg-paper px-3 py-2">
                    <div className="min-w-0 flex-1">
                        <LiveWaveform stream={cap.stream} height={32} />
                    </div>
                    <span className="text-xs tabular-nums text-muted">
                        {mmss(cap.seconds)}
                    </span>
                    <button
                        type="button"
                        onClick={cap.stop}
                        aria-label="Stop and fill"
                        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-600 text-white hover:bg-red-700"
                    >
                        <Square size={14} fill="currentColor" strokeWidth={0} />
                    </button>
                    <button
                        type="button"
                        onClick={cap.cancel}
                        aria-label="Cancel voice input"
                        className="shrink-0 text-muted hover:text-ink"
                    >
                        <X size={16} strokeWidth={1.75} />
                    </button>
                </div>
            ) : busy ? (
                <div className="flex w-full items-center justify-center gap-2 rounded border border-line bg-paper px-3.5 py-2.5 text-sm text-muted">
                    <Loader2 size={16} className="animate-spin" />
                    Understanding…
                </div>
            ) : (
                <button
                    type="button"
                    onClick={() => {
                        setError("");
                        cap.start();
                    }}
                    disabled={disabled}
                    className="flex w-full items-center justify-center gap-2 rounded border border-clinical-500 bg-clinical-50 px-3.5 py-2.5 text-sm font-medium text-clinical-600 transition-colors hover:bg-clinical-500 hover:text-paper disabled:opacity-40"
                >
                    <Mic size={16} strokeWidth={1.75} />
                    Speak to Edit
                </button>
            )}
            {shownError && (
                <p className="mt-2 text-sm text-alert-500">{shownError}</p>
            )}
        </div>
    );
}
