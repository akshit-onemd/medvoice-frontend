import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Loader2, X } from "lucide-react";
import { changeNoteTemplate, listTemplates } from "../api/processAudio";

// Rebuild a note from its recording with another template
export default function ChangeTemplateDialog({ consultationId, currentId, onChanged, onClose }) {
    const [list, setList] = useState(null);
    const [pick, setPick] = useState(currentId || "");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        listTemplates()
            .then((b) => setList(b.templates || []))
            .catch(() => setError("Couldn't load templates"));
    }, []);
    useEffect(() => {
        const onKey = (e) => e.key === "Escape" && !busy && onClose();
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [busy, onClose]);

    const go = async () => {
        setBusy(true);
        setError("");
        try {
            const body = await changeNoteTemplate(consultationId, pick);
            onChanged(body.structured_data);
            onClose();
        } catch (err) {
            setError(err.message || "Couldn't change the template. Please try again.");
            setBusy(false);
        }
    };

    return createPortal(
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-ink/50 p-4"
            onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()}
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-label="Change template"
                className="flex max-h-[85vh] w-full max-w-md flex-col rounded-md border border-line bg-surface shadow-panel"
            >
                <div className="flex items-center justify-between border-b border-line px-5 py-4">
                    <h2 className="font-display text-lg text-ink">Change template</h2>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={busy}
                        aria-label="Close"
                        className="rounded p-1 text-muted hover:bg-paper hover:text-ink"
                    >
                        <X size={16} />
                    </button>
                </div>
                <div className="overflow-y-auto px-5 py-4">
                    {!list && !error && (
                        <p className="flex items-center gap-2 text-sm text-muted">
                            <Loader2 size={14} className="animate-spin" /> Loading…
                        </p>
                    )}
                    <ul className="space-y-1.5">
                        {(list || []).map((t) => (
                            <li key={t.id}>
                                <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() => setPick(t.id)}
                                    className={`flex w-full items-center justify-between rounded border px-3 py-2 text-left text-sm transition-colors ${
                                        pick === t.id
                                            ? "border-clinical-500 bg-clinical-50 text-ink"
                                            : "border-line bg-surface text-ink hover:bg-paper"
                                    }`}
                                >
                                    <span>
                                        {t.name}
                                        <span className="block text-xs text-muted">
                                            {t.builtin ? t.specialty || "Library" : "My template"}
                                            {t.id === currentId ? " · current" : ""}
                                        </span>
                                    </span>
                                    {pick === t.id && <Check size={14} className="text-clinical-600" />}
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
                <div className="border-t border-line px-5 py-4">
                    <p className="mb-3 text-xs leading-relaxed text-muted">
                        The note is rebuilt from the recording with the new template. Changes you made on this note,
                        and an added AI plan, are replaced. Uploaded reports are not kept, so anything only in them
                        will be missing.
                    </p>
                    {error && <p className="mb-3 text-sm text-alert-500">{error}</p>}
                    <button
                        type="button"
                        onClick={go}
                        disabled={busy || !pick || pick === currentId}
                        className="flex w-full items-center justify-center gap-2 rounded bg-clinical-500 py-2.5 text-sm font-medium text-paper hover:bg-clinical-600 disabled:opacity-40"
                    >
                        {busy && <Loader2 size={14} className="animate-spin" />}
                        {busy ? "Rebuilding the note…" : "Rebuild with this template"}
                    </button>
                </div>
            </div>
        </div>,
        document.body,
    );
}
