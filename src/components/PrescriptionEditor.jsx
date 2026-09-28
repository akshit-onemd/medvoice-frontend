import React, { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { updatePrescription } from "../api/processAudio";

const inputCls =
    "w-full rounded border border-line bg-paper px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-clinical-500 outline-none";

const s = (v) => (v === null || v === undefined ? "" : String(v));
const dosageText = (d) =>
    Array.isArray(d) ? d.map(s).filter(Boolean).join("; ") : s(d);

// Keep each original entry (including hidden fields like dates) and only edit on top of it
const toForm = (rx) => ({
    symptoms: (rx?.symptoms || []).map((e) => ({ ...e })),
    medications: (rx?.medications || []).map((e) => ({
        ...e,
        dosage: dosageText(e.dosage),
    })),
    diagnosis: (rx?.diagnosis || []).map((e) => ({ ...e })),
    followup: (rx?.followup || []).map((e) => ({ ...e })),
});

function Field({ label, children }) {
    return (
        <label className="block">
            <span className="block text-xs text-muted mb-1">{label}</span>
            {children}
        </label>
    );
}

function Group({ title, addLabel, onAdd, children }) {
    return (
        <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-medium uppercase tracking-wide text-muted">
                    {title}
                </h3>
                <button
                    type="button"
                    onClick={onAdd}
                    className="inline-flex items-center gap-1 text-xs text-clinical-600 hover:underline"
                >
                    <Plus size={12} strokeWidth={2} />
                    {addLabel}
                </button>
            </div>
            <div className="space-y-3">{children}</div>
        </div>
    );
}

function Row({ onRemove, children }) {
    return (
        <div className="rounded border border-line bg-paper p-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {children}
            </div>
            <button
                type="button"
                onClick={onRemove}
                className="mt-2 inline-flex items-center gap-1 text-xs text-alert-500 hover:underline"
            >
                <Trash2 size={12} strokeWidth={1.75} />
                Remove
            </button>
        </div>
    );
}

export default function PrescriptionEditor({
    consultationId,
    prescription,
    onSaved,
    onCancel,
}) {
    const [form, setForm] = useState(() => toForm(prescription));
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    const update = (section, i, patch) =>
        setForm((f) => ({
            ...f,
            [section]: f[section].map((row, idx) =>
                idx === i ? { ...row, ...patch } : row,
            ),
        }));
    const add = (section, blank) =>
        setForm((f) => ({ ...f, [section]: [...f[section], blank] }));
    const remove = (section, i) =>
        setForm((f) => ({
            ...f,
            [section]: f[section].filter((_, idx) => idx !== i),
        }));

    const handleSave = async () => {
        setError("");
        setSaving(true);
        try {
            const payload = {
                ...form,
                medications: form.medications.map((m) => ({
                    ...m,
                    dosage: s(m.dosage)
                        .split(";")
                        .map((x) => x.trim())
                        .filter(Boolean),
                })),
            };
            const saved = await updatePrescription(consultationId, payload);
            onSaved(saved);
        } catch (err) {
            setError(err.message || "Couldn't save your changes.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="bg-surface border border-line rounded-md shadow-panel px-6 py-5">
            <h2 className="font-serif text-lg text-ink mb-4">
                Edit prescription &amp; plan
            </h2>

            <Group
                title="Symptoms / complaints"
                addLabel="Add symptom"
                onAdd={() =>
                    add("symptoms", { name: "", duration: "", notes: "" })
                }
            >
                {form.symptoms.map((e, i) => (
                    <Row key={i} onRemove={() => remove("symptoms", i)}>
                        <Field label="Symptom">
                            <input
                                className={inputCls}
                                value={s(e.name)}
                                onChange={(ev) =>
                                    update("symptoms", i, {
                                        name: ev.target.value,
                                    })
                                }
                            />
                        </Field>
                        <Field label="Duration">
                            <input
                                className={inputCls}
                                value={s(e.duration)}
                                onChange={(ev) =>
                                    update("symptoms", i, {
                                        duration: ev.target.value,
                                    })
                                }
                            />
                        </Field>
                        <div className="sm:col-span-2">
                            <Field label="Notes">
                                <input
                                    className={inputCls}
                                    value={s(e.notes)}
                                    onChange={(ev) =>
                                        update("symptoms", i, {
                                            notes: ev.target.value,
                                        })
                                    }
                                />
                            </Field>
                        </div>
                    </Row>
                ))}
            </Group>

            <Group
                title="Medications"
                addLabel="Add medication"
                onAdd={() =>
                    add("medications", {
                        name: "",
                        dosage: "",
                        duration: "",
                        instructions: "",
                    })
                }
            >
                {form.medications.map((e, i) => (
                    <Row key={i} onRemove={() => remove("medications", i)}>
                        <Field label="Medicine">
                            <input
                                className={inputCls}
                                value={s(e.name)}
                                onChange={(ev) =>
                                    update("medications", i, {
                                        name: ev.target.value,
                                    })
                                }
                            />
                        </Field>
                        <Field label="Dosage">
                            <input
                                className={inputCls}
                                placeholder="1 - 0 - 1"
                                value={s(e.dosage)}
                                onChange={(ev) =>
                                    update("medications", i, {
                                        dosage: ev.target.value,
                                    })
                                }
                            />
                        </Field>
                        <Field label="Duration">
                            <input
                                className={inputCls}
                                value={s(e.duration)}
                                onChange={(ev) =>
                                    update("medications", i, {
                                        duration: ev.target.value,
                                    })
                                }
                            />
                        </Field>
                        <Field label="Instructions">
                            <input
                                className={inputCls}
                                value={s(e.instructions)}
                                onChange={(ev) =>
                                    update("medications", i, {
                                        instructions: ev.target.value,
                                    })
                                }
                            />
                        </Field>
                    </Row>
                ))}
            </Group>

            <Group
                title="Diagnosis"
                addLabel="Add diagnosis"
                onAdd={() => add("diagnosis", { name: "" })}
            >
                {form.diagnosis.map((e, i) => (
                    <Row key={i} onRemove={() => remove("diagnosis", i)}>
                        <div className="sm:col-span-2">
                            <Field label="Diagnosis">
                                <input
                                    className={inputCls}
                                    value={s(e.name)}
                                    onChange={(ev) =>
                                        update("diagnosis", i, {
                                            name: ev.target.value,
                                        })
                                    }
                                />
                            </Field>
                        </div>
                    </Row>
                ))}
            </Group>

            <Group
                title="Follow up"
                addLabel="Add follow up"
                onAdd={() =>
                    add("followup", {
                        next_visit_duration: "",
                        date: "",
                        advice: "",
                    })
                }
            >
                {form.followup.map((e, i) => (
                    <Row key={i} onRemove={() => remove("followup", i)}>
                        <Field label="Next visit in">
                            <input
                                className={inputCls}
                                placeholder="2 days"
                                value={s(e.next_visit_duration)}
                                onChange={(ev) =>
                                    update("followup", i, {
                                        next_visit_duration: ev.target.value,
                                    })
                                }
                            />
                        </Field>
                        <Field label="Date">
                            <input
                                className={inputCls}
                                value={s(e.date)}
                                onChange={(ev) =>
                                    update("followup", i, {
                                        date: ev.target.value,
                                    })
                                }
                            />
                        </Field>
                        <div className="sm:col-span-2">
                            <Field label="Advice">
                                <input
                                    className={inputCls}
                                    value={s(e.advice)}
                                    onChange={(ev) =>
                                        update("followup", i, {
                                            advice: ev.target.value,
                                        })
                                    }
                                />
                            </Field>
                        </div>
                    </Row>
                ))}
            </Group>

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
                    onClick={handleSave}
                    disabled={saving}
                    className="flex-1 rounded bg-clinical-500 text-paper py-2.5 text-sm font-medium hover:bg-clinical-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                    {saving ? "Saving…" : "Save changes"}
                </button>
            </div>
        </div>
    );
}
