import React, { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { updateSection } from "../api/processAudio";

const inputCls =
    "w-full rounded border border-line bg-paper px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-clinical-500 outline-none";
const s = (v) => (v === null || v === undefined ? "" : String(v));

function Field({ label, children }) {
    return (
        <label className="block">
            <span className="block text-xs text-muted mb-1">{label}</span>
            {children}
        </label>
    );
}
function Row({ onRemove, children }) {
    return (
        <div className="rounded border border-line bg-paper p-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {children}
            </div>
            {onRemove && (
                <button
                    type="button"
                    onClick={onRemove}
                    className="mt-2 inline-flex items-center gap-1 text-xs text-alert-500 hover:underline"
                >
                    <Trash2 size={12} strokeWidth={1.75} /> Remove
                </button>
            )}
        </div>
    );
}
function AddButton({ label, onAdd }) {
    return (
        <button
            type="button"
            onClick={onAdd}
            className="inline-flex items-center gap-1 text-xs text-clinical-600 hover:underline"
        >
            <Plus size={12} strokeWidth={2} /> {label}
        </button>
    );
}
function SaveBar({ saving, error, onCancel, onSave }) {
    return (
        <>
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
                    onClick={onSave}
                    disabled={saving}
                    className="flex-1 rounded bg-clinical-500 text-paper py-2.5 text-sm font-medium hover:bg-clinical-600 disabled:opacity-40 transition-colors"
                >
                    {saving ? "Saving…" : "Save changes"}
                </button>
            </div>
        </>
    );
}

// ---- simple flat-field sections (must mirror backend SIMPLE_SECTIONS) ----
const SIMPLE_CONFIG = {
    allergies: {
        label: "Allergy",
        fields: [
            ["name", "Allergy"],
            ["notes", "Notes"],
        ],
    },
    conditions: {
        label: "Condition",
        fields: [
            ["name", "Condition"],
            ["duration", "Duration"],
            ["start_date", "Start date"],
            ["end_date", "End date"],
            ["notes", "Notes"],
        ],
    },
    procedures: {
        label: "Procedure",
        fields: [
            ["name", "Procedure"],
            ["date", "Date"],
            ["notes", "Notes"],
        ],
    },
    lifestyle_habits: {
        label: "Habit",
        fields: [
            ["name", "Habit"],
            ["frequency", "Frequency"],
            ["duration", "Duration"],
            ["start_date", "Start date"],
            ["end_date", "End date"],
            ["notes", "Notes"],
        ],
    },
    social_history: {
        label: "Item",
        fields: [
            ["name", "Item"],
            ["notes", "Notes"],
        ],
    },
    other_history: {
        label: "Item",
        fields: [
            ["name", "Item"],
            ["notes", "Notes"],
        ],
    },
    medication_history: {
        label: "Medication",
        fields: [
            ["name", "Medicine"],
            ["dosage", "Dosage"],
            ["duration", "Duration"],
            ["start_date", "Start date"],
            ["end_date", "End date"],
            ["status", "Status"],
        ],
        listField: "instruction",
    },
};

function SimpleListEditor({
    sectionKey,
    data,
    consultationId,
    onSaved,
    onCancel,
}) {
    const cfg = SIMPLE_CONFIG[sectionKey];
    const [rows, setRows] = useState(() =>
        (data || []).map((e) => ({
            ...cfg.fields.reduce((o, [f]) => ({ ...o, [f]: s(e[f]) }), {}),
            ...(cfg.listField
                ? {
                      [cfg.listField]: (Array.isArray(e[cfg.listField])
                          ? e[cfg.listField]
                          : []
                      ).join("; "),
                  }
                : {}),
        })),
    );
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    const update = (i, patch) =>
        setRows((r) =>
            r.map((row, idx) => (idx === i ? { ...row, ...patch } : row)),
        );
    const add = () =>
        setRows((r) => [
            ...r,
            {
                ...cfg.fields.reduce((o, [f]) => ({ ...o, [f]: "" }), {}),
                ...(cfg.listField ? { [cfg.listField]: "" } : {}),
            },
        ]);
    const remove = (i) => setRows((r) => r.filter((_, idx) => idx !== i));

    const handleSave = async () => {
        setError("");
        setSaving(true);
        try {
            const payload = rows.map((row) => {
                const out = { ...row };
                if (cfg.listField)
                    out[cfg.listField] = s(row[cfg.listField])
                        .split(";")
                        .map((x) => x.trim())
                        .filter(Boolean);
                return out;
            });
            onSaved(await updateSection(consultationId, sectionKey, payload));
        } catch (err) {
            setError(err.message || "Couldn't save your changes.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="bg-surface border border-line rounded-md shadow-panel px-6 py-5">
            <div className="flex items-center justify-between mb-4">
                <h2 className="font-serif text-lg text-ink">
                    Edit {cfg.label.toLowerCase()}s
                </h2>
                <AddButton
                    label={`Add ${cfg.label.toLowerCase()}`}
                    onAdd={add}
                />
            </div>
            <div className="space-y-3 mb-4">
                {rows.map((row, i) => (
                    <Row key={i} onRemove={() => remove(i)}>
                        {cfg.fields.map(([f, label]) => (
                            <Field key={f} label={label}>
                                <input
                                    className={inputCls}
                                    value={s(row[f])}
                                    onChange={(e) =>
                                        update(i, { [f]: e.target.value })
                                    }
                                />
                            </Field>
                        ))}
                        {cfg.listField && (
                            <div className="sm:col-span-2">
                                <Field label="Instructions">
                                    <input
                                        className={inputCls}
                                        placeholder="Separate multiple with ;"
                                        value={s(row[cfg.listField])}
                                        onChange={(e) =>
                                            update(i, {
                                                [cfg.listField]: e.target.value,
                                            })
                                        }
                                    />
                                </Field>
                            </div>
                        )}
                    </Row>
                ))}
                {rows.length === 0 && (
                    <p className="text-sm text-muted">Nothing added yet.</p>
                )}
            </div>
            <SaveBar
                saving={saving}
                error={error}
                onCancel={onCancel}
                onSave={handleSave}
            />
        </div>
    );
}

function VitalsEditor({ data, consultationId, onSaved, onCancel }) {
    const [rows, setRows] = useState(() => (data || []).map((v) => ({ ...v })));
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const update = (i, value) =>
        setRows((r) =>
            r.map((row, idx) => (idx === i ? { ...row, value } : row)),
        );
    const handleSave = async () => {
        setError("");
        setSaving(true);
        try {
            onSaved(await updateSection(consultationId, "vitals", rows));
        } catch (err) {
            setError(err.message || "Couldn't save your changes.");
        } finally {
            setSaving(false);
        }
    };
    return (
        <div className="bg-surface border border-line rounded-md shadow-panel px-6 py-5">
            <h2 className="font-serif text-lg text-ink mb-4">Edit vitals</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                {rows.map((v, i) => (
                    <Field
                        key={v.loinc_code || v.name}
                        label={`${v.name} (${v.units})`}
                    >
                        <input
                            className={inputCls}
                            value={s(v.value)}
                            onChange={(e) => update(i, e.target.value)}
                        />
                    </Field>
                ))}
            </div>
            <SaveBar
                saving={saving}
                error={error}
                onCancel={onCancel}
                onSave={handleSave}
            />
        </div>
    );
}

function FamilyHistoryEditor({ data, consultationId, onSaved, onCancel }) {
    const [rows, setRows] = useState(() =>
        (data || []).map((e) => ({
            relationship: s(e.relationship),
            illness: (e.illness || []).join(", "),
            notes: s(e.notes),
        })),
    );
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const update = (i, patch) =>
        setRows((r) =>
            r.map((row, idx) => (idx === i ? { ...row, ...patch } : row)),
        );
    const add = () =>
        setRows((r) => [...r, { relationship: "", illness: "", notes: "" }]);
    const remove = (i) => setRows((r) => r.filter((_, idx) => idx !== i));
    const handleSave = async () => {
        setError("");
        setSaving(true);
        try {
            const payload = rows.map((r) => ({
                relationship: r.relationship,
                illness: r.illness
                    .split(",")
                    .map((x) => x.trim())
                    .filter(Boolean),
                notes: r.notes,
            }));
            onSaved(
                await updateSection(consultationId, "family_history", payload),
            );
        } catch (err) {
            setError(err.message || "Couldn't save your changes.");
        } finally {
            setSaving(false);
        }
    };
    return (
        <div className="bg-surface border border-line rounded-md shadow-panel px-6 py-5">
            <div className="flex items-center justify-between mb-4">
                <h2 className="font-serif text-lg text-ink">
                    Edit family history
                </h2>
                <AddButton label="Add relative" onAdd={add} />
            </div>
            <div className="space-y-3 mb-4">
                {rows.map((row, i) => (
                    <Row key={i} onRemove={() => remove(i)}>
                        <Field label="Relationship">
                            <input
                                className={inputCls}
                                value={row.relationship}
                                onChange={(e) =>
                                    update(i, { relationship: e.target.value })
                                }
                            />
                        </Field>
                        <Field label="Illness (comma separated)">
                            <input
                                className={inputCls}
                                value={row.illness}
                                onChange={(e) =>
                                    update(i, { illness: e.target.value })
                                }
                            />
                        </Field>
                        <div className="sm:col-span-2">
                            <Field label="Notes">
                                <input
                                    className={inputCls}
                                    value={row.notes}
                                    onChange={(e) =>
                                        update(i, { notes: e.target.value })
                                    }
                                />
                            </Field>
                        </div>
                    </Row>
                ))}
                {rows.length === 0 && (
                    <p className="text-sm text-muted">Nothing added yet.</p>
                )}
            </div>
            <SaveBar
                saving={saving}
                error={error}
                onCancel={onCancel}
                onSave={handleSave}
            />
        </div>
    );
}

function SystemReviewEditor({ data, consultationId, onSaved, onCancel }) {
    const [rows, setRows] = useState(() =>
        (data || []).map((e) => ({
            name: s(e.name),
            findings: (e.findings || []).map((f) => f.finding).join(", "),
            notes: s(e.notes),
        })),
    );
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const update = (i, patch) =>
        setRows((r) =>
            r.map((row, idx) => (idx === i ? { ...row, ...patch } : row)),
        );
    const add = () =>
        setRows((r) => [...r, { name: "", findings: "", notes: "" }]);
    const remove = (i) => setRows((r) => r.filter((_, idx) => idx !== i));
    const handleSave = async () => {
        setError("");
        setSaving(true);
        try {
            const payload = rows.map((r) => ({
                name: r.name,
                findings: r.findings
                    .split(",")
                    .map((x) => x.trim())
                    .filter(Boolean),
                notes: r.notes,
            }));
            onSaved(
                await updateSection(consultationId, "system_review", payload),
            );
        } catch (err) {
            setError(err.message || "Couldn't save your changes.");
        } finally {
            setSaving(false);
        }
    };
    return (
        <div className="bg-surface border border-line rounded-md shadow-panel px-6 py-5">
            <div className="flex items-center justify-between mb-4">
                <h2 className="font-serif text-lg text-ink">
                    Edit system review
                </h2>
                <AddButton label="Add system" onAdd={add} />
            </div>
            <div className="space-y-3 mb-4">
                {rows.map((row, i) => (
                    <Row key={i} onRemove={() => remove(i)}>
                        <Field label="System">
                            <input
                                className={inputCls}
                                value={row.name}
                                onChange={(e) =>
                                    update(i, { name: e.target.value })
                                }
                            />
                        </Field>
                        <Field label="Findings (comma separated)">
                            <input
                                className={inputCls}
                                value={row.findings}
                                onChange={(e) =>
                                    update(i, { findings: e.target.value })
                                }
                            />
                        </Field>
                        <div className="sm:col-span-2">
                            <Field label="Notes">
                                <input
                                    className={inputCls}
                                    value={row.notes}
                                    onChange={(e) =>
                                        update(i, { notes: e.target.value })
                                    }
                                />
                            </Field>
                        </div>
                    </Row>
                ))}
                {rows.length === 0 && (
                    <p className="text-sm text-muted">Nothing added yet.</p>
                )}
            </div>
            <SaveBar
                saving={saving}
                error={error}
                onCancel={onCancel}
                onSave={handleSave}
            />
        </div>
    );
}

function InvestigationsEditor({ data, consultationId, onSaved, onCancel }) {
    const [rows, setRows] = useState(() =>
        (data || []).map((inv) => ({
            name: s(inv.name),
            date: s(inv.date),
            readings: (inv.readings || []).map((r) => ({
                investigation_name: s(r.investigation_name),
                result: s(r.result),
                unit: s(r.unit),
                interpretation: s(r.interpretation),
                notes: s(r.notes),
            })),
        })),
    );
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    const updateInv = (i, patch) =>
        setRows((r) =>
            r.map((row, idx) => (idx === i ? { ...row, ...patch } : row)),
        );
    const addInv = () =>
        setRows((r) => [...r, { name: "", date: "", readings: [] }]);
    const removeInv = (i) => setRows((r) => r.filter((_, idx) => idx !== i));
    const updateReading = (i, j, patch) =>
        setRows((r) =>
            r.map((row, idx) =>
                idx === i
                    ? {
                          ...row,
                          readings: row.readings.map((rd, jdx) =>
                              jdx === j ? { ...rd, ...patch } : rd,
                          ),
                      }
                    : row,
            ),
        );
    const addReading = (i) =>
        setRows((r) =>
            r.map((row, idx) =>
                idx === i
                    ? {
                          ...row,
                          readings: [
                              ...row.readings,
                              {
                                  investigation_name: "",
                                  result: "",
                                  unit: "",
                                  interpretation: "",
                                  notes: "",
                              },
                          ],
                      }
                    : row,
            ),
        );
    const removeReading = (i, j) =>
        setRows((r) =>
            r.map((row, idx) =>
                idx === i
                    ? {
                          ...row,
                          readings: row.readings.filter((_, jdx) => jdx !== j),
                      }
                    : row,
            ),
        );

    const handleSave = async () => {
        setError("");
        setSaving(true);
        try {
            onSaved(
                await updateSection(
                    consultationId,
                    "investigation_history",
                    rows,
                ),
            );
        } catch (err) {
            setError(err.message || "Couldn't save your changes.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="bg-surface border border-line rounded-md shadow-panel px-6 py-5">
            <div className="flex items-center justify-between mb-4">
                <h2 className="font-serif text-lg text-ink">
                    Edit investigations
                </h2>
                <AddButton label="Add investigation" onAdd={addInv} />
            </div>
            <div className="space-y-4 mb-4">
                {rows.map((inv, i) => (
                    <div
                        key={i}
                        className="rounded border border-line bg-paper p-3"
                    >
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                            <Field label="Investigation name">
                                <input
                                    className={inputCls}
                                    value={inv.name}
                                    onChange={(e) =>
                                        updateInv(i, { name: e.target.value })
                                    }
                                />
                            </Field>
                            <Field label="Date">
                                <input
                                    className={inputCls}
                                    value={inv.date}
                                    onChange={(e) =>
                                        updateInv(i, { date: e.target.value })
                                    }
                                />
                            </Field>
                        </div>
                        <div className="space-y-2">
                            {inv.readings.map((rd, j) => (
                                <div
                                    key={j}
                                    className="rounded border border-line bg-surface p-2"
                                >
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                        <input
                                            className={inputCls}
                                            placeholder="Test"
                                            value={rd.investigation_name}
                                            onChange={(e) =>
                                                updateReading(i, j, {
                                                    investigation_name:
                                                        e.target.value,
                                                })
                                            }
                                        />
                                        <input
                                            className={inputCls}
                                            placeholder="Result"
                                            value={rd.result}
                                            onChange={(e) =>
                                                updateReading(i, j, {
                                                    result: e.target.value,
                                                })
                                            }
                                        />
                                        <input
                                            className={inputCls}
                                            placeholder="Unit"
                                            value={rd.unit}
                                            onChange={(e) =>
                                                updateReading(i, j, {
                                                    unit: e.target.value,
                                                })
                                            }
                                        />
                                        <input
                                            className={inputCls}
                                            placeholder="Interpretation"
                                            value={rd.interpretation}
                                            onChange={(e) =>
                                                updateReading(i, j, {
                                                    interpretation:
                                                        e.target.value,
                                                })
                                            }
                                        />
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => removeReading(i, j)}
                                        className="mt-1 inline-flex items-center gap-1 text-xs text-alert-500 hover:underline"
                                    >
                                        <Trash2 size={11} strokeWidth={1.75} />
                                        Remove test
                                    </button>
                                </div>
                            ))}
                            <AddButton
                                label="Add test"
                                onAdd={() => addReading(i)}
                            />
                        </div>
                        <button
                            type="button"
                            onClick={() => removeInv(i)}
                            className="mt-2 inline-flex items-center gap-1 text-xs text-alert-500 hover:underline"
                        >
                            <Trash2 size={12} strokeWidth={1.75} /> Remove
                            investigation
                        </button>
                    </div>
                ))}
                {rows.length === 0 && (
                    <p className="text-sm text-muted">Nothing added yet.</p>
                )}
            </div>
            <SaveBar
                saving={saving}
                error={error}
                onCancel={onCancel}
                onSave={handleSave}
            />
        </div>
    );
}

export default function HistorySectionEditor({
    sectionKey,
    consultationId,
    data,
    onSaved,
    onCancel,
}) {
    const props = { data, consultationId, onSaved, onCancel };
    if (sectionKey === "vitals") return <VitalsEditor {...props} />;
    if (sectionKey === "family_history")
        return <FamilyHistoryEditor {...props} />;
    if (sectionKey === "system_review")
        return <SystemReviewEditor {...props} />;
    if (sectionKey === "investigation_history")
        return <InvestigationsEditor {...props} />;
    return <SimpleListEditor sectionKey={sectionKey} {...props} />;
}
