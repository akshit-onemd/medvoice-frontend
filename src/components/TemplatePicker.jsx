import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, LayoutTemplate, X } from "lucide-react";
import { forgetTemplates, useTemplateList } from "../api/templateCache";
import TemplateSearchList from "./TemplateSearchList";
import { useBackLayer } from "../hooks/useBackNav";

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
    // The popup: Esc closes it, and the page behind doesn't scroll
    const panelRef = useRef(null);
    // Back closes the popup instead of leaving the page
    useBackLayer(open, () => {
        setOpen(false);
        return "stay";
    });
    useEffect(() => {
        if (!open) return undefined;
        const prev = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        panelRef.current?.focus(); // the popup, not the search box, so no keyboard pops up on phones
        const onKey = (e) => {
            if (e.key === "Escape") {
                e.stopPropagation();
                setOpen(false);
                buttonRef.current?.focus();
            }
        };
        document.addEventListener("keydown", onKey);
        return () => {
            document.body.style.overflow = prev;
            document.removeEventListener("keydown", onKey);
        };
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
            {open &&
                createPortal(
                    // Full screen on phones, a centred window on larger screens. Browse or search.
                    <div
                        className="fixed inset-0 z-[100] flex items-stretch justify-center bg-ink/50 sm:items-center sm:p-4"
                        onMouseDown={(e) => e.target === e.currentTarget && close()}
                    >
                        <div
                            ref={panelRef}
                            tabIndex={-1}
                            role="dialog"
                            aria-modal="true"
                            aria-label="Choose a template"
                            className="flex h-full w-full flex-col bg-surface outline-none sm:h-[min(80vh,640px)] sm:max-w-lg sm:rounded-md sm:border sm:border-line sm:shadow-panel"
                        >
                            <div className="flex shrink-0 items-center justify-between border-b border-line px-4 py-3">
                                <h2 className="font-display text-lg text-ink">Choose a template</h2>
                                <button
                                    type="button"
                                    onClick={close}
                                    aria-label="Close"
                                    className="rounded p-1.5 text-muted hover:bg-paper hover:text-ink"
                                >
                                    <X size={18} />
                                </button>
                            </div>
                            <div className="min-h-0 flex-1 px-4 pb-4 pt-3" style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}>
                                <TemplateSearchList
                                    list={list}
                                    value={value}
                                    autoFocus={false}
                                    fill
                                    onPick={(t) => {
                                        onChange(t.id);
                                        close();
                                    }}
                                    onEscape={close}
                                />
                            </div>
                        </div>
                    </div>,
                    document.body,
                )}
        </div>
    );
}
