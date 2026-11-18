import React, { useEffect, useRef, useState } from "react";
import { ChevronDown, LayoutTemplate } from "lucide-react";
import { forgetTemplates, useTemplateList } from "../api/templateCache";
import TemplateSearchList from "./TemplateSearchList";

export const forgetTemplateList = () => forgetTemplates();
export { rememberTemplate } from "./TemplateSearchList";

// Which template the next note uses. Starts on the doctor's default; click to search.
export default function TemplatePicker({ value, onChange, disabled }) {
    // Shown at once from the last visit (or the prefetch at sign-in), refreshed quietly
    const { data: list, loading } = useTemplateList();
    const [open, setOpen] = useState(false);
    const boxRef = useRef(null);
    const buttonRef = useRef(null);
    // Pick the default once the list arrives (or if the chosen one disappeared)
    useEffect(() => {
        if (!list?.length) return;
        if (!value || !list.some((t) => t.id === value)) {
            const def = list.find((t) => t.isDefault) || list[0];
            onChange(def.id);
        }
    }, [list, value, onChange]);
    // Close on a click outside
    useEffect(() => {
        if (!open) return;
        const onDown = (e) => {
            if (!boxRef.current?.contains(e.target)) setOpen(false);
        };
        document.addEventListener("mousedown", onDown);
        return () => document.removeEventListener("mousedown", onDown);
    }, [open]);

    // Keep the row's place while the first list loads, so the page doesn't jump
    if (loading)
        return (
            <div className="mb-4 flex h-[38px] items-center gap-2 rounded border border-line bg-surface px-3 text-sm text-muted" aria-busy="true">
                <LayoutTemplate size={15} strokeWidth={1.75} className="shrink-0" />
                <span className="shrink-0">Template</span>
                <span className="h-3 w-32 animate-pulse rounded bg-line" />
            </div>
        );
    if (!list || list.length < 2) return null;
    const chosen = list.find((t) => t.id === value);
    const close = () => {
        setOpen(false);
        buttonRef.current?.focus();
    };

    return (
        <div ref={boxRef} className="relative mb-4">
            <button
                ref={buttonRef}
                type="button"
                disabled={disabled}
                aria-haspopup="listbox"
                aria-expanded={open}
                onClick={() => setOpen((o) => !o)}
                className="flex w-full items-center gap-2 rounded border border-line bg-surface px-3 py-2 text-left text-sm text-ink hover:border-clinical-500 disabled:opacity-50"
            >
                <LayoutTemplate size={15} strokeWidth={1.75} className="shrink-0 text-muted" />
                <span className="shrink-0 text-muted">Template</span>
                <span className="min-w-0 flex-1 truncate font-medium">{chosen?.name || "Choose…"}</span>
                <ChevronDown size={15} className={`shrink-0 text-muted transition-transform ${open ? "rotate-180" : ""}`} />
            </button>
            {open && (
                <div className="absolute left-0 right-0 z-40 mt-1 rounded-md border border-line bg-surface p-2 shadow-panel">
                    <TemplateSearchList
                        list={list}
                        value={value}
                        onPick={(t) => {
                            onChange(t.id);
                            close();
                        }}
                        onEscape={close}
                    />
                </div>
            )}
        </div>
    );
}
