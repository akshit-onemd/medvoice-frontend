import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Search, X } from "lucide-react";
import { searchCodes } from "../api/processAudio";
import { VOCAB_LABEL } from "../utils/codeItems";

export default function CodePickerDialog({ item, onPick, onClose }) {
    const [query, setQuery] = useState("");
    const [results, setResults] = useState([]);
    const [searching, setSearching] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const panelRef = useRef(null);

    const suggested = [
        ...(item.code
            ? [{ code: item.code, term: item.codeTerm || item.term }]
            : []),
        ...item.alts,
    ];

    useEffect(() => {
        const prev = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        panelRef.current?.focus();
        return () => {
            document.body.style.overflow = prev;
        };
    }, []);

    useEffect(() => {
        const q = query.trim();
        if (q.length < 2) {
            setResults([]);
            setSearching(false);
            return;
        }
        setSearching(true);
        let cancelled = false;
        const t = setTimeout(async () => {
            try {
                const d = await searchCodes(item.vocab, q);
                if (!cancelled) setResults(d.results || []);
            } catch {
                if (!cancelled) setResults([]);
            } finally {
                if (!cancelled) setSearching(false);
            }
        }, 350);
        return () => {
            cancelled = true;
            clearTimeout(t);
        };
    }, [query, item.vocab]);

    const pick = async (code) => {
        setBusy(true);
        setError("");
        try {
            await onPick(code);
            onClose();
        } catch (err) {
            setError(err.message || "Couldn't save the code.");
            setBusy(false);
        }
    };

    const Row = ({ r, mark }) => (
        <li>
            <button
                type="button"
                disabled={busy}
                onClick={() => pick(r.code)}
                className="flex w-full items-start gap-3 px-3 py-2.5 text-left hover:bg-paper disabled:opacity-50"
            >
                <div className="min-w-0 flex-1">
                    <p className="text-sm text-ink">{r.term || r.code}</p>
                    <p className="text-xs text-muted">{r.code}</p>
                </div>
                {mark && (
                    <span className="shrink-0 rounded-full border border-line bg-paper px-1.5 py-0.5 text-[10px] text-muted">
                        {mark}
                    </span>
                )}
            </button>
        </li>
    );

    return createPortal(
        <div
            className="fixed inset-0 z-[70] flex items-end justify-center bg-ink/50 sm:items-center sm:p-4"
            onMouseDown={(e) => {
                if (e.target === e.currentTarget && !busy) onClose();
            }}
        >
            <div
                ref={panelRef}
                tabIndex={-1}
                role="dialog"
                aria-modal="true"
                className="flex w-full flex-col overflow-hidden rounded-t-lg border border-line bg-surface shadow-panel outline-none sm:max-w-lg sm:rounded-md"
                style={{ height: "min(80vh, 620px)", maxHeight: "85dvh" }}
            >
                <div className="flex shrink-0 items-start justify-between gap-3 px-5 pb-3 pt-5">
                    <div className="min-w-0">
                        <h2 className="truncate font-serif text-lg text-ink">
                            Choose a code
                        </h2>
                        <p className="truncate text-xs text-muted">
                            {VOCAB_LABEL[item.vocab]} for “{item.term}”
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={busy}
                        aria-label="Close"
                        className="shrink-0 text-muted hover:text-ink"
                    >
                        <X size={18} strokeWidth={1.75} />
                    </button>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">
                    {suggested.length > 0 && (
                        <>
                            <p className="text-[11px] font-medium uppercase tracking-wide text-muted">
                                Suggested
                            </p>
                            <ul className="mt-1.5 divide-y divide-line overflow-hidden rounded border border-line">
                                {suggested.map((r, i) => (
                                    <Row
                                        key={r.code}
                                        r={r}
                                        mark={
                                            i === 0 && item.code
                                                ? "Best match"
                                                : ""
                                        }
                                    />
                                ))}
                            </ul>
                        </>
                    )}

                    <p className="mt-4 text-[11px] font-medium uppercase tracking-wide text-muted">
                        Search
                    </p>
                    <div className="relative mt-1.5">
                        <Search
                            size={14}
                            strokeWidth={1.75}
                            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
                        />
                        <input
                            className="w-full rounded border border-line bg-paper py-2 pl-9 pr-3 text-sm text-ink outline-none focus:border-clinical-500"
                            placeholder="Type a name or code"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                        />
                    </div>
                    {searching && (
                        <p className="mt-2 text-xs text-muted">Searching…</p>
                    )}
                    {results.length > 0 && (
                        <ul className="mt-2 divide-y divide-line overflow-hidden rounded border border-line">
                            {results.map((r) => (
                                <Row key={r.code} r={r} />
                            ))}
                        </ul>
                    )}
                    {query.trim().length >= 2 &&
                        !searching &&
                        results.length === 0 && (
                            <p className="mt-2 text-xs text-muted">No match.</p>
                        )}
                    {error && (
                        <p className="mt-3 text-sm text-alert-500">{error}</p>
                    )}
                </div>
            </div>
        </div>,
        document.body,
    );
}
