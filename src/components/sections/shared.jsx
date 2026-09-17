import React from "react";
import { Check, AlertTriangle, HelpCircle, RefreshCw } from "lucide-react";
// True if the entry has at least one non-empty string field or a
// non-empty array field. The backend's template ships with one blank
// placeholder object per section, so entries that were never filled
// in by the model need to be filtered out before rendering.
export function hasContent(entry) {
    if (!entry || typeof entry !== "object") return false;
    return Object.values(entry).some((value) => {
        if (Array.isArray(value)) return value.length > 0;
        if (typeof value === "string") return value.trim().length > 0;
        return Boolean(value);
    });
}

export function usableList(list) {
    return Array.isArray(list) ? list.filter(hasContent) : [];
}

export function SectionCard({
    icon: Icon,
    title,
    count,
    tone = "clinical",
    children,
}) {
    return (
        <section className="bg-surface border border-line rounded-md shadow-panel">
            <header className="flex items-center gap-3 px-6 py-4 border-b border-line">
                <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded ${
                        tone === "alert"
                            ? "bg-alert-50 text-alert-500"
                            : "bg-clinical-50 text-clinical-600"
                    }`}
                >
                    <Icon size={16} strokeWidth={1.75} />
                </div>
                <h3 className="font-serif text-base text-ink flex-1">
                    {title}
                </h3>
                {typeof count === "number" && (
                    <span className="text-xs text-muted tabular-nums">
                        {count}
                    </span>
                )}
            </header>
            <div className="px-6 py-5">{children}</div>
        </section>
    );
}

export function EmptyNote({ children }) {
    return <p className="text-sm text-muted italic">{children}</p>;
}

export function MetaRow({ items }) {
    const visible = items.filter((i) => i.value);
    if (visible.length === 0) return null;
    return (
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
            {visible.map((item) => (
                <span key={item.label} className="text-xs text-muted">
                    {item.label}:{" "}
                    <span className="text-ink/80">{item.value}</span>
                </span>
            ))}
        </div>
    );
}

export function Chip({ children }) {
    return (
        <span className="inline-block rounded bg-paper border border-line px-2 py-0.5 text-xs text-ink mr-1.5 mb-1.5">
            {children}
        </span>
    );
}
export function CodeTag({ system, code, term, verified, corrected }) {
    if (!code) return null;
    const icon = corrected ? (
        <RefreshCw size={10} strokeWidth={2.5} className="text-amber-400" />
    ) : verified === true ? (
        <Check size={10} strokeWidth={2.5} className="text-clinical-600" />
    ) : verified === false ? (
        <AlertTriangle size={10} strokeWidth={2.5} className="text-alert-500" />
    ) : (
        <HelpCircle size={10} strokeWidth={2.5} className="text-muted" />
    );
    const title = corrected
        ? `Model's original code was wrong — auto-corrected via UMLS${term ? ": " + term : ""}`
        : verified === true
          ? `Verified in UMLS${term ? ": " + term : ""}`
          : verified === false
            ? "Not found in UMLS — could not auto-correct"
            : "Not yet verified";
    return (
        <span
            className="inline-flex items-center gap-1 rounded border border-line bg-surface px-1.5 py-0.5 text-[10px] font-mono text-muted mr-1.5 mb-1.5 align-middle"
            title={title}
        >
            {icon}
            {system} · {code}
        </span>
    );
}

export function CodeRow({ codes }) {
    const visible = codes.filter((c) => c.code);
    if (visible.length === 0) return null;
    return (
        <div className="flex flex-wrap mt-1.5">
            {visible.map((c, i) => (
                <CodeTag
                    key={i}
                    system={c.system}
                    code={c.code}
                    term={c.term}
                    verified={c.verified}
                    corrected={c.corrected}
                />
            ))}
        </div>
    );
}