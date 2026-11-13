import React from "react";
import { ClipboardList } from "lucide-react";
import { SectionCard } from "./shared";
import { shapeOf, STATUS_LABELS } from "../../templates/general";

const statusCls = {
    yes: "bg-alert-50 text-alert-500 border-alert-500/30",
    no: "bg-clinical-50 text-clinical-600 border-clinical-500/30",
    not_examined: "bg-paper text-muted border-line",
};

// One of the template's own sections, read-only
export default function GeneralSectionCard({ section: s, value, title }) {
    const d = shapeOf(s, value);
    return (
        <SectionCard icon={ClipboardList} title={title || s.title}>
            {s.type === "values" && (
                <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-3">
                    {s.fields
                        .filter((f) => d[f.key].trim())
                        .map((f) => (
                            <div key={f.key}>
                                <dt className="text-xs text-muted">{f.label}</dt>
                                <dd className="text-base text-ink tabular-nums">
                                    {d[f.key]}
                                    {f.unit && <span className="text-sm text-muted"> {f.unit}</span>}
                                </dd>
                                {f.range && <dd className="text-[11px] text-muted">Normal {f.range}</dd>}
                            </div>
                        ))}
                </dl>
            )}
            {s.type === "list" && (
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-left text-xs text-muted">
                                {s.fields.map((f) => (
                                    <th key={f.key} className="pb-2 pr-3 font-normal">
                                        {f.label}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {d.map((row, i) => (
                                <tr key={i} className="border-t border-line">
                                    {s.fields.map((f) => (
                                        <td key={f.key} className="py-1.5 pr-3 text-ink">
                                            {row[f.key]}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
            {s.type === "checklist" && (
                <ul className="space-y-2">
                    {d
                        .filter((x) => x.status || x.note.trim())
                        .map((x) => (
                            <li key={x.item} className="flex flex-wrap items-baseline gap-2">
                                <span className="text-base text-ink">{x.item}</span>
                                {x.status && (
                                    <span
                                        className={`rounded-full border px-2 py-0.5 text-xs ${statusCls[x.status] || ""}`}
                                    >
                                        {STATUS_LABELS[x.status]}
                                    </span>
                                )}
                                {x.note && <span className="text-sm text-muted">{x.note}</span>}
                            </li>
                        ))}
                </ul>
            )}
            {s.type === "choice" && (
                <div className="flex flex-wrap gap-2">
                    {d.selected.map((o) => (
                        <span
                            key={o}
                            className="rounded-full border border-clinical-500/30 bg-clinical-50 px-2.5 py-1 text-sm text-clinical-600"
                        >
                            {o}
                        </span>
                    ))}
                </div>
            )}
            {s.type === "score" && (
                <p className="text-base text-ink">
                    <span className="text-2xl font-display tabular-nums">{d.value}</span>
                    <span className="text-muted"> / {s.max}</span>
                    {d.note && <span className="block text-sm text-muted mt-1">{d.note}</span>}
                </p>
            )}
            {s.type === "text" && <p className="text-base text-ink whitespace-pre-wrap">{d.text}</p>}
        </SectionCard>
    );
}
