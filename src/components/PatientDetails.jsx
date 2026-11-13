import React, { useEffect, useState } from "react";
import { Loader2, Pencil, X } from "lucide-react";
import { getPatient, updatePatient } from "../api/processAudio";
import { HISTORY, HABITS, ageLabel } from "../utils/patientValidation";
import ConsentBadge from "./ConsentBadge";
import ConsentRecordDialog from "./ConsentRecordDialog";
import PatientForm from "./PatientForm";

const clean = (v) => (v == null ? "" : String(v).trim());
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : "");

const dobText = (dob) => {
    if (!dob) return "";
    const d = new Date(`${String(dob).slice(0, 10)}T00:00:00`);
    return Number.isNaN(d.getTime())
        ? ""
        : d.toLocaleDateString("en-IN", {
              day: "2-digit",
              month: "short",
              year: "numeric",
          });
};

function Row({ label, children }) {
    return (
        <div className="grid grid-cols-[8.5rem_1fr] gap-3 py-1.5 text-sm">
            <dt className="text-muted">{label}</dt>
            <dd className="min-w-0 break-words text-ink">{children}</dd>
        </div>
    );
}

function Section({ title, rows }) {
    const shown = rows.filter((r) => r && r[1]);
    if (!shown.length) return null;
    return (
        <section className="mt-4 first:mt-0">
            <p className="mb-1 group-label">
                {title}
            </p>
            <dl className="divide-y divide-line">
                {shown.map(([label, value]) => (
                    <Row key={label} label={label}>
                        {value}
                    </Row>
                ))}
            </dl>
        </section>
    );
}

const phoneLink = (n) =>
    n ? (
        <a
            href={`tel:${n}`}
            className="text-clinical-600 underline underline-offset-2"
        >
            {n}
        </a>
    ) : (
        ""
    );

/** Every detail we hold for a patient. Empty fields are left out.
 *  The doctor can edit every field here (Edit details) and open the consent record.
 *  onSaved(patient): called with the saved patient so the page can update its header.
 *  onRecordConsent(): opens the consent form (only where the page has one). */
export default function PatientDetails({
    patient,
    consent,
    onSaved,
    onRecordConsent,
}) {
    const [full, setFull] = useState(patient);
    const [loading, setLoading] = useState(true);
    const [failed, setFailed] = useState(false);
    const [editing, setEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState("");
    const [showConsentRecord, setShowConsentRecord] = useState(false);

    const save = async (payload) => {
        setSaving(true);
        setSaveError("");
        try {
            const saved = await updatePatient(patient.id, payload);
            setFull((f) => ({ ...f, ...saved }));
            setEditing(false);
            onSaved?.(saved);
        } catch (err) {
            setSaveError(err.message || "Couldn't save the changes.");
        } finally {
            setSaving(false);
        }
    };

    useEffect(() => {
        let cancelled = false;
        setFull(patient);
        setLoading(true);
        setFailed(false);
        getPatient(patient.id)
            .then((p) => !cancelled && setFull({ ...patient, ...p }))
            .catch(() => !cancelled && setFailed(true))
            .finally(() => !cancelled && setLoading(false));
        return () => {
            cancelled = true;
        };
    }, [patient.id]);

    const p = full || patient;
    const med = p.medical || {};
    const title = clean(p.title);
    const email = clean(p.email);
    const age = p.dob
        ? ageLabel(String(p.dob).slice(0, 10))
        : p.age != null
          ? `${p.age} yr${p.age === 1 ? "" : "s"}`
          : "";
    const place = [clean(p.address), clean(p.city), clean(p.pincode)]
        .filter(Boolean)
        .join(", ");
    const referrer = [clean(p.referred_by_name), clean(p.referred_by_phone)]
        .filter(Boolean)
        .join(" · ");

    const history = HISTORY.map(([k, label]) => [label, clean(med[k])]);
    const habits = HABITS.map(([k, label]) => [label, clean(med[k])]);
    const medicalRows = [
        ["Blood group", clean(med.blood_group)],
        med.no_known_history
            ? ["Medical history", "No known medical history"]
            : null,
        ...history,
        ...habits,
    ];

    const sections = [
        {
            title: "Patient",
            rows: [
                ["Name", [title, clean(p.name)].filter(Boolean).join(" ")],
                ["UHID", clean(p.uhid)],
                ["Gender", cap(clean(p.gender))],
                ["Date of birth", dobText(p.dob)],
                ["Age", age],
                ["Marital status", clean(p.marital_status)],
                ["Occupation", clean(p.occupation)],
            ],
        },
        {
            title: "Contact",
            rows: [
                ["Phone", phoneLink(clean(p.phone))],
                ["Alternative phone", phoneLink(clean(p.alt_phone))],
                [
                    "Email",
                    email ? (
                        <a
                            href={`mailto:${email}`}
                            className="text-clinical-600 underline underline-offset-2"
                        >
                            {email}
                        </a>
                    ) : (
                        ""
                    ),
                ],
                ["Address", place],
            ],
        },
        {
            title: "Source and referral",
            rows: [
                ["Informant", clean(p.informant_name)],
                ["Channel", clean(p.channel)],
                ["Tag", clean(p.tag)],
                ["Referred by", referrer],
            ],
        },
        { title: "Medical background", rows: medicalRows },
    ];

    const anyExtra =
        [
            p.title,
            p.uhid,
            p.dob,
            p.marital_status,
            p.occupation,
            p.alt_phone,
            email,
            place,
            p.informant_name,
            p.channel,
            p.tag,
            referrer,
        ].some((v) => clean(v)) || medicalRows.some((r) => r && r[1]);

    if (editing) {
        return (
            <PatientForm
                initial={p}
                submitLabel="Save changes"
                cancelLabel="Cancel"
                saving={saving}
                error={saveError}
                onSubmit={save}
                onCancel={() => {
                    setEditing(false);
                    setSaveError("");
                }}
            />
        );
    }

    return (
        <div>
            <div className="mb-2 flex justify-end">
                <button
                    type="button"
                    onClick={() => setEditing(true)}
                    disabled={loading}
                    className="inline-flex items-center gap-1 text-xs font-medium text-clinical-600 underline underline-offset-2 disabled:opacity-40"
                >
                    <Pencil size={12} strokeWidth={1.75} />
                    Edit details
                </button>
            </div>
            {sections.map((s) => (
                <Section key={s.title} title={s.title} rows={s.rows} />
            ))}
            {consent && (
                <section className="mt-4">
                    <p className="mb-1 group-label">
                        Consent
                    </p>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 py-1.5">
                        <ConsentBadge
                            status={consent}
                            hint
                            onClick={
                                consent === "valid"
                                    ? () => setShowConsentRecord(true)
                                    : onRecordConsent
                            }
                        />
                        {consent === "valid" && (
                            <span className="text-sm text-ink">
                                Consent on file
                            </span>
                        )}
                        <button
                            type="button"
                            onClick={() => setShowConsentRecord(true)}
                            className="text-xs text-clinical-600 underline underline-offset-2"
                        >
                            View consent record
                        </button>
                    </div>
                </section>
            )}
            {showConsentRecord && (
                <ConsentRecordDialog
                    patient={p}
                    onClose={() => setShowConsentRecord(false)}
                    onRecord={
                        onRecordConsent
                            ? () => {
                                  setShowConsentRecord(false);
                                  onRecordConsent();
                              }
                            : undefined
                    }
                />
            )}
            {loading && (
                <p className="mt-3 inline-flex items-center gap-2 text-xs text-muted">
                    <Loader2 size={12} className="animate-spin" /> Loading full
                    record…
                </p>
            )}
            {!loading && failed && (
                <p className="mt-3 text-xs text-muted">
                    Couldn't refresh the record. Showing what is already loaded.
                </p>
            )}
            {!loading && !failed && !anyExtra && (
                <p className="mt-3 text-xs text-muted">
                    Only the basic details have been recorded for this patient.
                </p>
            )}
        </div>
    );
}

/** Same content in a pop-up, for places where the page is already busy (the new visit screen). */
export function PatientDetailsDialog({
    patient,
    consent,
    onClose,
    onSaved,
    onRecordConsent,
}) {
    useEffect(() => {
        const onKey = (e) => e.key === "Escape" && onClose?.();
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [onClose]);

    return (
        <div
            className="fixed inset-0 z-[70] flex items-end justify-center bg-ink/40 sm:items-center"
            onClick={onClose}
            role="dialog"
            aria-modal="true"
            aria-label={`Details for ${patient.name}`}
        >
            <div
                className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-md border border-line bg-surface p-4 shadow-panel sm:rounded-md"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="mb-3 flex items-start justify-between gap-3">
                    <h2 className="font-display text-xl text-ink">
                        Patient details
                    </h2>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close"
                        className="shrink-0 rounded border border-line p-1.5 text-muted hover:bg-paper"
                    >
                        <X size={16} strokeWidth={1.75} />
                    </button>
                </div>
                <PatientDetails
                    patient={patient}
                    consent={consent}
                    onSaved={onSaved}
                    onRecordConsent={onRecordConsent}
                />
            </div>
        </div>
    );
}
