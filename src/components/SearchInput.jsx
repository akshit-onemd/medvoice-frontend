import React, { useEffect, useRef, useState } from "react";
import { Mic, Square } from "lucide-react";

const SR =
    typeof window !== "undefined"
        ? window.SpeechRecognition || window.webkitSpeechRecognition
        : null;

// "9 8 2 0 0 9 8 2 0 0" -> "9820098200"; otherwise trim trailing punctuation
function normalize(t) {
    const s = t.trim().replace(/[.,!?]+$/, "");
    const compact = s.replace(/[\s-]/g, "");
    return /^\+?\d{6,}$/.test(compact) ? compact : s;
}

export default function SearchInput({
    value,
    onChange,
    placeholder,
    inputClassName,
    autoFocus = false,
    disabled = false,
}) {
    const [listening, setListening] = useState(false);
    const [voiceError, setVoiceError] = useState("");
    const recRef = useRef(null);
    const onChangeRef = useRef(onChange);
    onChangeRef.current = onChange;

    useEffect(() => () => recRef.current?.abort(), []);

    const toggle = () => {
        if (listening) {
            recRef.current?.stop();
            return;
        }
        setVoiceError("");
        const rec = new SR();
        rec.lang = "en-IN";
        rec.interimResults = true;
        rec.continuous = false;
        rec.onresult = (e) => {
            let t = "";
            for (let i = 0; i < e.results.length; i++)
                t += e.results[i][0].transcript;
            onChangeRef.current(normalize(t));
        };
        rec.onerror = (e) => {
            setListening(false);
            if (
                e.error === "not-allowed" ||
                e.error === "service-not-allowed"
            ) {
                setVoiceError("Microphone permission was denied.");
            } else if (e.error === "no-speech") {
                setVoiceError("Didn't catch that. Try again.");
            } else if (e.error !== "aborted") {
                setVoiceError("Voice input failed.");
            }
        };
        rec.onend = () => setListening(false);
        recRef.current = rec;
        try {
            rec.start();
            setListening(true);
        } catch {
            setListening(false);
        }
    };

    return (
        <div>
            <div className="relative">
                <input
                    type="text"
                    placeholder={placeholder}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    autoFocus={autoFocus}
                    className={`${inputClassName} ${SR ? "pr-11" : ""}`}
                />
                {SR && (
                    <button
                        type="button"
                        onClick={toggle}
                        disabled={disabled}
                        aria-label={
                            listening ? "Stop voice input" : "Search by voice"
                        }
                        title={listening ? "Stop" : "Search by voice"}
                        className={`absolute right-1.5 top-1/2 -translate-y-1/2 inline-flex h-8 w-8 items-center justify-center rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                            listening
                                ? "bg-red-600 text-white animate-pulse"
                                : "text-clinical-600 hover:bg-clinical-50"
                        }`}
                    >
                        {listening ? (
                            <Square
                                size={14}
                                fill="currentColor"
                                strokeWidth={2}
                            />
                        ) : (
                            <Mic size={16} strokeWidth={1.75} />
                        )}
                    </button>
                )}
            </div>
            {voiceError && (
                <p className="text-xs text-alert-500 mt-1">{voiceError}</p>
            )}
        </div>
    );
}
