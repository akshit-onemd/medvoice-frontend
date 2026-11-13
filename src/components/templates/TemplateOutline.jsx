import React from "react";
import { SECTION_TYPES } from "../../templates/sectionTypes";
import { GENERAL_LABELS, isGeneral } from "../../templates/general";

const detailOf = (s) => {
    if (s.type === "values" || s.type === "list")
        return (s.fields || []).map((f) => f.label + (f.unit ? ` (${f.unit})` : "")).join(", ");
    if (s.type === "checklist") return (s.items || []).join(", ");
    if (s.type === "choice") return (s.options || []).join(" / ") + (s.multiple ? " · pick several" : "");
    if (s.type === "score") return `${s.min ?? 0} to ${s.max ?? 10}`;
    return "";
};

// A read-only picture of what a note made with this template contains
export default function TemplateOutline({ def }) {
    const secs = Array.isArray(def?.sections) ? def.sections : [];
    if (!secs.length) return <p className="text-sm text-muted italic">No sections yet.</p>;
    return (
        <ol className="space-y-2">
            {secs.map((s, i) => {
                const general = isGeneral(s);
                const base = general ? GENERAL_LABELS[s.type] : SECTION_TYPES[s.type]?.title;
                const detail = detailOf(s);
                return (
                    <li key={`${s.id}-${i}`} className="rounded border border-line bg-paper px-3 py-2">
                        <div className="flex items-baseline justify-between gap-3">
                            <span className="text-sm font-medium text-ink">
                                {s.title || base}
                            </span>
                            <span className="shrink-0 text-[11px] text-muted">{base || s.type}</span>
                        </div>
                        {detail && <p className="mt-0.5 text-xs text-muted">{detail}</p>}
                        {s.instructions && <p className="mt-0.5 text-xs italic text-muted">{s.instructions}</p>}
                    </li>
                );
            })}
        </ol>
    );
}
