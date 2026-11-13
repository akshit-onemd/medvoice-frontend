import React, { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { saveCustomSection } from "../api/processAudio";
import { shapeOf, STATUS_LABELS } from "../templates/general";

const inputCls =
    "w-full rounded border border-line px-3 py-2.5 text-sm text-ink placeholder:text-muted focus:border-clinical-500 outline-none";

// Edits one of the template's own sections and saves it
export default function GeneralSectionEditor({ section: s, value, title, consultationId, onSaved, onCancel }) {
    const [d, setD] = useState(() => {
        const v = shapeOf(s, value);
        return s.type === "list" && !v.length ? [Object.fromEntries(s.fields.map((f) => [f.key, ""]))] : v;
    });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    const save = async () => {
        setSaving(true);
        setError("");
        try {
            const body = await saveCustomSection(consultationId, s.id, d);
            onSaved(body.custom);
        } catch (err) {
            setError(err.message || "Couldn't save. Please try again.");
            setSaving(false);
        }
    };

    return (
        <div className="bg-surface border border-line rounded-md shadow-panel px-6 py-5">
            <h3 className="font-display text-xl text-ink mb-4">{title || s.title}</h3>
            {s.type === "values" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                    {s.fields.map((f) => (
                        <label key={f.key} className="block">
                            <span className="block text-xs text-muted mb-1">
                                {f.label}
                                {f.unit ? ` (${f.unit})` : ""}
                            </span>
                            <input
                                className={inputCls}
                                value={d[f.key]}
                                placeholder={f.range ? `Normal ${f.range}` : ""}
                                onChange={(e) => setD({ ...d, [f.key]: e.target.value })}
                            />
                        </label>
                    ))}
                </div>
            )}
            {s.type === "list" && (
                <div className="space-y-3 mb-4">
                    {d.map((row, i) => (
                        <div key={i} className="rounded border border-line bg-paper p-3">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {s.fields.map((f) => (
                                    <label key={f.key} className="block">
                                        <span className="block text-xs text-muted mb-1">{f.label}</span>
                                        <input
                                            className={inputCls}
                                            value={row[f.key]}
                                            onChange={(e) =>
                                                setD(d.map((r, j) => (j === i ? { ...r, [f.key]: e.target.value } : r)))
                                            }
                                        />
                                    </label>
                                ))}
                            </div>
                            <button
                                type="button"
                                onClick={() => setD(d.filter((_, j) => j !== i))}
                                className="mt-2 inline-flex items-center gap-1 text-xs text-alert-500 hover:underline"
                            >
                                <Trash2 size={12} strokeWidth={1.75} /> Remove
                            </button>
                        </div>
                    ))}
                    <button
                        type="button"
                        onClick={() => setD([...d, Object.fromEntries(s.fields.map((f) => [f.key, ""]))])}
                        className="inline-flex items-center gap-1 text-xs text-clinical-600 hover:underline"
                    >
                        <Plus size={12} strokeWidth={2} /> Add row
                    </button>
                </div>
            )}
            {s.type === "checklist" && (
                <div className="space-y-3 mb-4">
                    {d.map((x, i) => (
                        <div key={x.item} className="rounded border border-line bg-paper p-3">
                            <p className="text-sm text-ink mb-2">{x.item}</p>
                            <div className="flex flex-wrap gap-2 mb-2">
                                {["yes", "no", "not_examined"].map((st) => (
                                    <button
                                        key={st}
                                        type="button"
                                        aria-pressed={x.status === st}
                                        onClick={() =>
                                            setD(d.map((y, j) => (j === i ? { ...y, status: y.status === st ? "" : st } : y)))
                                        }
                                        className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                                            x.status === st
                                                ? "border-clinical-500 bg-clinical-500 text-paper"
                                                : "border-line bg-surface text-ink hover:bg-clinical-50"
                                        }`}
                                    >
                                        {STATUS_LABELS[st]}
                                    </button>
                                ))}
                            </div>
                            <input
                                className={inputCls}
                                placeholder="Note"
                                value={x.note}
                                onChange={(e) => setD(d.map((y, j) => (j === i ? { ...y, note: e.target.value } : y)))}
                            />
                        </div>
                    ))}
                </div>
            )}
            {s.type === "choice" && (
                <div className="flex flex-wrap gap-2 mb-4">
                    {s.options.map((o) => {
                        const on = d.selected.includes(o);
                        return (
                            <button
                                key={o}
                                type="button"
                                aria-pressed={on}
                                onClick={() =>
                                    setD({
                                        selected: on
                                            ? d.selected.filter((x) => x !== o)
                                            : s.multiple
                                              ? [...d.selected, o]
                                              : [o],
                                    })
                                }
                                className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                                    on
                                        ? "border-clinical-500 bg-clinical-500 text-paper"
                                        : "border-line bg-surface text-ink hover:bg-clinical-50"
                                }`}
                            >
                                {o}
                            </button>
                        );
                    })}
                </div>
            )}
            {s.type === "score" && (
                <div className="grid grid-cols-1 sm:grid-cols-[8rem_1fr] gap-3 mb-4">
                    <label className="block">
                        <span className="block text-xs text-muted mb-1">
                            Score ({s.min}–{s.max})
                        </span>
                        <input
                            type="number"
                            min={s.min}
                            max={s.max}
                            className={inputCls}
                            value={d.value}
                            onChange={(e) => setD({ ...d, value: e.target.value })}
                        />
                    </label>
                    <label className="block">
                        <span className="block text-xs text-muted mb-1">Note</span>
                        <input className={inputCls} value={d.note} onChange={(e) => setD({ ...d, note: e.target.value })} />
                    </label>
                </div>
            )}
            {s.type === "text" && (
                <textarea
                    rows={4}
                    className={`${inputCls} mb-4`}
                    value={d.text}
                    onChange={(e) => setD({ text: e.target.value })}
                />
            )}
            {error && <p className="mb-3 text-sm text-alert-500">{error}</p>}
            <div className="flex gap-3">
                <button
                    type="button"
                    onClick={onCancel}
                    disabled={saving}
                    className="rounded border border-line bg-surface px-5 py-2.5 text-sm text-ink hover:bg-paper disabled:opacity-40"
                >
                    Cancel
                </button>
                <button
                    type="button"
                    onClick={save}
                    disabled={saving}
                    className="flex-1 rounded bg-clinical-500 text-paper py-2.5 text-sm font-medium hover:bg-clinical-600 disabled:opacity-40 transition-colors"
                >
                    {saving ? "Saving…" : "Save changes"}
                </button>
            </div>
        </div>
    );
}
