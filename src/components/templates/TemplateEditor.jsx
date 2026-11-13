import React, { useState } from "react";
import { ArrowDown, ArrowUp, Loader2, Plus, Trash2 } from "lucide-react";
import { createTemplate, updateTemplate } from "../../api/processAudio";
import { SECTION_TYPES } from "../../templates/sectionTypes";
import { GENERAL_LABELS, GENERAL_TYPES, isGeneral } from "../../templates/general";
import TemplateOutline from "./TemplateOutline";

const inputCls =
    "w-full rounded border border-line px-3 py-2.5 text-sm text-ink placeholder:text-muted focus:border-clinical-500 outline-none bg-surface";
const slug = (t) =>
    String(t || "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "")
        .slice(0, 36) || "section";
const uniqueId = (base, used) => {
    let id = /^[a-z]/.test(base) ? base : `s_${base}`;
    let n = 2;
    while (used.has(id)) id = `${base}_${n++}`;
    return id;
};
const lines = (v) => (Array.isArray(v) ? v.join("\n") : "");
const fromLines = (t) =>
    t
        .split("\n")
        .map((x) => x.trim())
        .filter(Boolean);

function newSection(type, used) {
    const general = GENERAL_TYPES.includes(type);
    const title = general ? GENERAL_LABELS[type] : SECTION_TYPES[type].title;
    const s = { id: uniqueId(general ? slug(title) : type, used), type, title };
    if (type === "values") s.fields = [{ key: "value_1", label: "", unit: "" }];
    if (type === "list") s.fields = [{ key: "item", label: "Item" }];
    if (type === "checklist") s.items = [];
    if (type === "choice") Object.assign(s, { options: [], multiple: false });
    if (type === "score") Object.assign(s, { min: 0, max: 10 });
    return s;
}

function FieldsEditor({ s, onChange, units }) {
    const set = (i, patch) =>
        onChange({ ...s, fields: s.fields.map((f, j) => (j === i ? { ...f, ...patch } : f)) });
    return (
        <div className="space-y-2">
            {s.fields.map((f, i) => (
                <div key={i} className="flex gap-2">
                    <input
                        className={inputCls}
                        placeholder="Label, e.g. HbA1c"
                        value={f.label}
                        onChange={(e) => {
                            const label = e.target.value;
                            const auto = !f.key || f.key === slug(f.label) || /^value_\d+$/.test(f.key);
                            set(i, auto ? { label, key: slug(label) } : { label });
                        }}
                    />
                    {units && (
                        <input
                            className={`${inputCls} max-w-[7rem]`}
                            placeholder="Unit"
                            value={f.unit || ""}
                            onChange={(e) => set(i, { unit: e.target.value })}
                        />
                    )}
                    <button
                        type="button"
                        aria-label="Remove field"
                        onClick={() => onChange({ ...s, fields: s.fields.filter((_, j) => j !== i) })}
                        className="shrink-0 rounded border border-line px-2 text-muted hover:text-alert-500"
                    >
                        <Trash2 size={14} />
                    </button>
                </div>
            ))}
            <button
                type="button"
                onClick={() =>
                    onChange({ ...s, fields: [...s.fields, { key: `value_${s.fields.length + 1}`, label: "", unit: "" }] })
                }
                className="inline-flex items-center gap-1 text-xs text-clinical-600 hover:underline"
            >
                <Plus size={12} /> Add field
            </button>
        </div>
    );
}

// Hand editing of a template: name, sections, their order and settings
export default function TemplateEditor({ initial, templateId, onSaved, onCancel }) {
    const [def, setDef] = useState(() => ({
        name: initial?.name || "",
        specialty: initial?.specialty || "",
        kind: initial?.kind || "",
        description: initial?.description || "",
        sections: (initial?.sections || []).map((s) => ({ ...s })),
    }));
    const [adding, setAdding] = useState("");
    const [saving, setSaving] = useState(false);
    const [errors, setErrors] = useState([]);
    const used = new Set(def.sections.map((s) => s.id));
    const clinicalLeft = Object.keys(SECTION_TYPES).filter((t) => !def.sections.some((s) => s.type === t));

    const setSec = (i, s) => setDef((d) => ({ ...d, sections: d.sections.map((x, j) => (j === i ? s : x)) }));
    const move = (i, by) =>
        setDef((d) => {
            const a = [...d.sections];
            const j = i + by;
            if (j < 0 || j >= a.length) return d;
            [a[i], a[j]] = [a[j], a[i]];
            return { ...d, sections: a };
        });

    const save = async () => {
        setSaving(true);
        setErrors([]);
        try {
            const body = templateId ? await updateTemplate(templateId, def) : await createTemplate(def);
            onSaved(body);
        } catch (err) {
            setErrors([err.message || "Couldn't save the template"]);
            setSaving(false);
        }
    };

    return (
        <div className="grid gap-5 lg:grid-cols-[1fr_18rem]">
            <div className="space-y-4">
                <div className="rounded-md border border-line bg-surface p-5 shadow-panel space-y-3">
                    <label className="block">
                        <span className="mb-1 block text-xs text-muted">Template name</span>
                        <input
                            className={inputCls}
                            value={def.name}
                            maxLength={80}
                            onChange={(e) => setDef({ ...def, name: e.target.value })}
                        />
                    </label>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <label className="block">
                            <span className="mb-1 block text-xs text-muted">Specialty</span>
                            <input
                                className={inputCls}
                                value={def.specialty}
                                onChange={(e) => setDef({ ...def, specialty: e.target.value })}
                            />
                        </label>
                        <label className="block">
                            <span className="mb-1 block text-xs text-muted">Visit type</span>
                            <select
                                className={inputCls}
                                value={def.kind}
                                onChange={(e) => setDef({ ...def, kind: e.target.value })}
                            >
                                <option value="">Any</option>
                                <option value="new">New patient</option>
                                <option value="follow_up">Follow-up</option>
                                <option value="condition">Condition-specific</option>
                            </select>
                        </label>
                    </div>
                    <label className="block">
                        <span className="mb-1 block text-xs text-muted">When to use it (optional)</span>
                        <input
                            className={inputCls}
                            value={def.description}
                            maxLength={200}
                            onChange={(e) => setDef({ ...def, description: e.target.value })}
                        />
                    </label>
                </div>

                {def.sections.map((s, i) => {
                    const general = isGeneral(s);
                    return (
                        <div key={`${s.id}-${i}`} className="rounded-md border border-line bg-surface p-4 shadow-panel">
                            <div className="mb-3 flex items-center gap-2">
                                <span className="rounded-full border border-line bg-paper px-2 py-0.5 text-[11px] text-muted">
                                    {general ? GENERAL_LABELS[s.type] : SECTION_TYPES[s.type]?.title}
                                </span>
                                <div className="ml-auto flex gap-1">
                                    <button type="button" aria-label="Move up" onClick={() => move(i, -1)} className="rounded border border-line p-1 text-muted hover:text-ink">
                                        <ArrowUp size={14} />
                                    </button>
                                    <button type="button" aria-label="Move down" onClick={() => move(i, 1)} className="rounded border border-line p-1 text-muted hover:text-ink">
                                        <ArrowDown size={14} />
                                    </button>
                                    <button
                                        type="button"
                                        aria-label="Remove section"
                                        onClick={() => setDef({ ...def, sections: def.sections.filter((_, j) => j !== i) })}
                                        className="rounded border border-line p-1 text-muted hover:text-alert-500"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>
                            <div className="space-y-3">
                                <input
                                    className={inputCls}
                                    placeholder="Title"
                                    value={s.title || ""}
                                    maxLength={60}
                                    onChange={(e) => setSec(i, { ...s, title: e.target.value })}
                                />
                                <input
                                    className={inputCls}
                                    placeholder="Instructions for the scribe (optional)"
                                    value={s.instructions || ""}
                                    maxLength={300}
                                    onChange={(e) => setSec(i, { ...s, instructions: e.target.value })}
                                />
                                {(s.type === "values" || s.type === "list") && (
                                    <FieldsEditor s={s} units={s.type === "values"} onChange={(x) => setSec(i, x)} />
                                )}
                                {(s.type === "checklist" || s.type === "choice") && (
                                    <label className="block">
                                        <span className="mb-1 block text-xs text-muted">
                                            {s.type === "checklist" ? "Items, one per line" : "Options, one per line"}
                                        </span>
                                        <textarea
                                            rows={4}
                                            className={inputCls}
                                            defaultValue={lines(s.type === "checklist" ? s.items : s.options)}
                                            onBlur={(e) =>
                                                setSec(i, {
                                                    ...s,
                                                    [s.type === "checklist" ? "items" : "options"]: fromLines(e.target.value),
                                                })
                                            }
                                        />
                                    </label>
                                )}
                                {s.type === "choice" && (
                                    <label className="flex items-center gap-2 text-sm text-ink">
                                        <input
                                            type="checkbox"
                                            checked={!!s.multiple}
                                            onChange={(e) => setSec(i, { ...s, multiple: e.target.checked })}
                                        />
                                        Allow more than one
                                    </label>
                                )}
                                {s.type === "score" && (
                                    <div className="flex gap-2">
                                        <input type="number" className={inputCls} value={s.min} onChange={(e) => setSec(i, { ...s, min: Number(e.target.value) })} aria-label="Lowest" />
                                        <input type="number" className={inputCls} value={s.max} onChange={(e) => setSec(i, { ...s, max: Number(e.target.value) })} aria-label="Highest" />
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}

                <div className="flex flex-wrap items-center gap-2 rounded-md border border-dashed border-line bg-surface p-4">
                    <select className={`${inputCls} max-w-xs`} value={adding} onChange={(e) => setAdding(e.target.value)}>
                        <option value="">Add a section…</option>
                        {clinicalLeft.length > 0 && (
                            <optgroup label="Standard sections">
                                {clinicalLeft.map((t) => (
                                    <option key={t} value={t}>
                                        {SECTION_TYPES[t].title}
                                    </option>
                                ))}
                            </optgroup>
                        )}
                        <optgroup label="Your own">
                            {GENERAL_TYPES.map((t) => (
                                <option key={t} value={t}>
                                    {GENERAL_LABELS[t]}
                                </option>
                            ))}
                        </optgroup>
                    </select>
                    <button
                        type="button"
                        disabled={!adding}
                        onClick={() => {
                            setDef({ ...def, sections: [...def.sections, newSection(adding, used)] });
                            setAdding("");
                        }}
                        className="inline-flex items-center gap-1 rounded border border-line bg-paper px-3 py-2 text-sm text-ink hover:bg-clinical-50 disabled:opacity-40"
                    >
                        <Plus size={14} /> Add
                    </button>
                </div>

                {errors.length > 0 && (
                    <ul className="space-y-1 text-sm text-alert-500">
                        {errors.map((e, i) => (
                            <li key={i}>{e}</li>
                        ))}
                    </ul>
                )}
                <div className="flex gap-3">
                    <button type="button" onClick={onCancel} disabled={saving} className="rounded border border-line bg-surface px-5 py-2.5 text-sm text-ink hover:bg-paper disabled:opacity-40">
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={save}
                        disabled={saving || !def.name.trim() || !def.sections.length}
                        className="flex flex-1 items-center justify-center gap-2 rounded bg-clinical-500 py-2.5 text-sm font-medium text-paper hover:bg-clinical-600 disabled:opacity-40"
                    >
                        {saving && <Loader2 size={14} className="animate-spin" />}
                        {saving ? "Saving…" : "Save template"}
                    </button>
                </div>
            </div>
            <aside className="lg:sticky lg:top-24 self-start rounded-md border border-line bg-surface p-4 shadow-panel">
                <p className="mb-3 font-display text-base text-ink">Preview</p>
                <TemplateOutline def={def} />
            </aside>
        </div>
    );
}
