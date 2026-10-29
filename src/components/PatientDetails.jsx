import React, { useEffect, useState } from "react";
import { Loader2, X } from "lucide-react";
import { getPatient } from "../api/processAudio";
import { HISTORY, HABITS, ageLabel } from "../utils/patientValidation";
import ConsentBadge from "./ConsentBadge";

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
            <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted">
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

/** Every detail we hold for a patient. Empty fields are left out. */
export default function PatientDetails({ patient, consent }) {
    const [full, setFull] = useState(patient);
    const [loading, setLoading] = useState(true);
    const [failed, setFailed] = useState(false);

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

    return (
        <div>
            {sections.map((s) => (
                <Section key={s.title} title={s.title} rows={s.rows} />
            ))}
            {consent && (
                <section className="mt-4">
                    <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted">
                        Consent
                    </p>
                    <div className="py-1.5">
                        <ConsentBadge status={consent} />
                    </div>
                </section>
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
export function PatientDetailsDialog({ patient, consent, onClose }) {
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
                    <h2 className="font-serif text-xl text-ink">
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
                <PatientDetails patient={patient} consent={consent} />
            </div>
        </div>
    );
}
