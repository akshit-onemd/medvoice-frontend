import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Loader2, X } from "lucide-react";
import { changeNoteTemplate } from "../api/processAudio";
import { useTemplateList } from "../api/templateCache";
import TemplateSearchList, { rememberTemplate } from "./TemplateSearchList";

// Rebuild a note from its recording with another template
export default function ChangeTemplateDialog({ consultationId, currentId, onChanged, onClose }) {
    const { data: list, error: listError } = useTemplateList();
    const [pick, setPick] = useState(currentId || "");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        if (listError) setError("Couldn't load templates");
    }, [listError]);
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
            rememberTemplate(pick);
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
                    {list && (
                        <TemplateSearchList
                            list={list}
                            value={pick}
                            currentId={currentId}
                            onPick={(t) => !busy && setPick(t.id)}
                            autoFocus={false}
                            maxHeight="45vh"
                        />
                    )}
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
