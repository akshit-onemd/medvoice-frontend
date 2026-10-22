import React, { useState } from "react";
import { ChevronDown, ShieldCheck } from "lucide-react";
import { saveCodes } from "../api/processAudio";
import { VOCAB_LABEL } from "../utils/codeItems";

export default function CodeReviewPanel({
    items,
    canEdit,
    consultationId,
    onChanged,
    onPick,
}) {
    const [open, setOpen] = useState(false);
    const [busy, setBusy] = useState("");
    const [error, setError] = useState("");

    const need = items.filter(
        (i) => i.status === "review" || i.status === "none",
    );
    if (!need.length) return null;
    const confirmable = need.filter((i) => i.code);

    const run = async (changes, key) => {
        setBusy(key);
        setError("");
        try {
            const body = await saveCodes(consultationId, changes);
            onChanged(body.structured_data);
        } catch (err) {
            setError(err.message || "Couldn't save. Please try again.");
        } finally {
            setBusy("");
        }
    };

    return (
        <div className="mb-5 rounded-md border border-amber-400 bg-surface shadow-panel">
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                aria-expanded={open}
                className={`flex w-full items-center gap-2 px-5 py-3.5 text-left ${open ? "border-b border-line" : ""}`}
            >
                <ShieldCheck
                    size={16}
                    strokeWidth={1.75}
                    className="shrink-0 text-amber-700"
                />
                <h3 className="flex-1 font-serif text-lg text-ink">
                    Codes to review
                </h3>
                <span className="rounded-full border border-amber-400 bg-amber-50 px-2 py-0.5 text-[11px] text-amber-700">
                    {need.length}
                </span>
                <span className="inline-flex shrink-0 items-center gap-1 text-xs text-clinical-600">
                    {open ? "Show less" : "Show more"}
                    <ChevronDown
                        size={12}
                        className={`transition-transform ${open ? "rotate-180" : ""}`}
                    />
                </span>
            </button>

            {open && (
                <div className="px-5 py-4">
                    <p className="text-xs text-muted">
                        These are best matches, not exact ones. Confirm each, or
                        pick a better code.
                    </p>
                    <ul className="mt-3 divide-y divide-line overflow-hidden rounded border border-line">
                        {need.map((it) => (
                            <li key={it.id} className="px-3 py-2.5">
                                <div className="flex flex-wrap items-center gap-2">
                                    <p className="text-sm font-medium text-ink">
                                        {it.term}
                                    </p>
                                    <span className="rounded-full border border-line bg-paper px-1.5 py-0.5 text-[10px] text-muted">
                                        {it.label}
                                    </span>
                                    <span className="rounded-full border border-line bg-paper px-1.5 py-0.5 text-[10px] text-muted">
                                        {VOCAB_LABEL[it.vocab]}
                                    </span>
                                </div>
                                {it.code ? (
                                    <p className="mt-0.5 text-xs text-amber-700">
                                        {it.code}
                                        {it.codeTerm ? ` · ${it.codeTerm}` : ""}
                                    </p>
                                ) : (
                                    <p className="mt-0.5 text-xs text-muted">
                                        No match found. Search for a code.
                                    </p>
                                )}
                                {canEdit && (
                                    <div className="mt-2 flex gap-2">
                                        {it.code && (
                                            <button
                                                type="button"
                                                disabled={!!busy}
                                                onClick={() =>
                                                    run(
                                                        [
                                                            {
                                                                path: it.path,
                                                                code: it.code,
                                                            },
                                                        ],
                                                        it.id,
                                                    )
                                                }
                                                className="rounded bg-clinical-500 px-3 py-1.5 text-xs font-medium text-paper hover:bg-clinical-600 disabled:opacity-40"
                                            >
                                                {busy === it.id
                                                    ? "Saving…"
                                                    : "Confirm"}
                                            </button>
                                        )}
                                        <button
                                            type="button"
                                            disabled={!!busy}
                                            onClick={() => onPick(it)}
                                            className="rounded border border-line bg-surface px-3 py-1.5 text-xs text-ink hover:bg-paper disabled:opacity-40"
                                        >
                                            {it.code ? "Change" : "Find code"}
                                        </button>
                                    </div>
                                )}
                            </li>
                        ))}
                    </ul>
                    {error && (
                        <p className="mt-3 text-sm text-alert-500">{error}</p>
                    )}
                    {canEdit && confirmable.length > 1 && (
                        <button
                            type="button"
                            disabled={!!busy}
                            onClick={() =>
                                run(
                                    confirmable.map((i) => ({
                                        path: i.path,
                                        code: i.code,
                                    })),
                                    "all",
                                )
                            }
                            className="mt-3 w-full rounded border border-clinical-500 bg-clinical-50 py-2 text-sm font-medium text-clinical-600 hover:bg-clinical-500 hover:text-paper disabled:opacity-40"
                        >
                            {busy === "all"
                                ? "Saving…"
                                : `Confirm all ${confirmable.length}`}
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}
