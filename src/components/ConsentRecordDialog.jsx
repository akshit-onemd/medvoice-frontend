import React, { useEffect, useState } from "react";
import { Loader2, X, CheckCircle2, AlertTriangle } from "lucide-react";
import { getConsentRecord } from "../api/consent";

const when = (iso) =>
    new Date(iso)
        .toLocaleString("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
        })
        .replace(",", " ·");

const SIGNER = {
    self: "The patient",
    guardian: "Parent or guardian",
    representative: "Someone on the patient's behalf",
};
const DECISION = {
    granted: "Agreed",
    declined: "Declined",
    withdrawn: "Withdrawn",
};
const BY = { doctor: "the doctor", staff: "clinic staff" };
const STATUS = {
    valid: "Consent on file",
    none: "No consent recorded",
    outdated: "Agreed to an older notice. Re-consent needed.",
    declined: "Declined",
    withdrawn: "Withdrawn",
};

function Row({ label, children }) {
    if (!children) return null;
    return (
        <div className="grid grid-cols-[8.5rem_1fr] gap-3 py-1.5 text-sm">
            <dt className="text-muted">{label}</dt>
            <dd className="min-w-0 break-words text-ink">{children}</dd>
        </div>
    );
}

/** What the patient agreed to, when, who signed, and every earlier decision. Read-only. */
export default function ConsentRecordDialog({ patient, onClose, onRecord }) {
    const [rec, setRec] = useState(null);
    const [error, setError] = useState("");
    const [showNotice, setShowNotice] = useState(false);

    useEffect(() => {
        let off = false;
        getConsentRecord(patient.id)
            .then((r) => !off && setRec(r))
            .catch(
                (e) =>
                    !off &&
                    setError(e.message || "Couldn't load the consent record."),
            );
        return () => {
            off = true;
        };
    }, [patient.id]);

    useEffect(() => {
        const onKey = (e) => e.key === "Escape" && onClose?.();
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [onClose]);

    const g = rec?.granted;
    const ok = rec?.status === "valid";
    const n = g?.notice;

    return (
        <div
            className="fixed inset-0 z-[80] flex items-end justify-center bg-ink/40 sm:items-center"
            onClick={onClose}
            role="dialog"
            aria-modal="true"
            aria-label={`Consent for ${patient.name}`}
        >
            <div
                className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-md border border-line bg-surface p-4 shadow-panel sm:rounded-md"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="mb-3 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <h2 className="font-serif text-xl text-ink">Consent</h2>
                        <p className="text-sm text-muted">{patient.name}</p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close"
                        className="shrink-0 rounded border border-line p-1.5 text-muted hover:bg-paper"
                    >
                        <X size={16} strokeWidth={1.75} />
                    </button>
                </div>

                {!rec && !error && (
                    <p className="inline-flex items-center gap-2 text-sm text-muted">
                        <Loader2 size={14} className="animate-spin" /> Loading…
                    </p>
                )}
                {error && <p className="text-sm text-alert-500">{error}</p>}

                {rec && (
                    <>
                        <p
                            className={`mb-3 inline-flex items-center gap-1.5 text-sm font-medium ${
                                ok ? "text-clinical-600" : "text-amber-700"
                            }`}
                        >
                            {ok ? (
                                <CheckCircle2 size={16} strokeWidth={2.25} />
                            ) : (
                                <AlertTriangle size={16} strokeWidth={2.25} />
                            )}
                            {STATUS[rec.status] || STATUS.none}
                        </p>
                        {!ok && onRecord && (
                            <button
                                type="button"
                                onClick={onRecord}
                                className="mb-3 ml-3 text-sm text-clinical-600 underline underline-offset-2"
                            >
                                {rec.status === "outdated"
                                    ? "Re-sign now"
                                    : "Record consent now"}
                            </button>
                        )}

                        {g ? (
                            <section>
                                <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted">
                                    Latest agreement
                                </p>
                                <dl className="divide-y divide-line">
                                    <Row label="Agreed on">{when(g.at)}</Row>
                                    <Row label="Signed by">
                                        {[g.signer_name, SIGNER[g.signer_type]]
                                            .filter(Boolean)
                                            .join(" · ")}
                                    </Row>
                                    <Row label="Relationship">
                                        {g.signer_relationship}
                                    </Row>
                                    <Row label="Reason">
                                        {g.on_behalf_reason}
                                    </Row>
                                    <Row label="Recorded by">
                                        {BY[g.captured_by_role] &&
                                            `Collected by ${BY[g.captured_by_role]}`}
                                    </Row>
                                    <Row label="Notice version">
                                        {`${g.notice_version}${g.outdated ? ` (current is ${rec.current_notice_version})` : ""}`}
                                    </Row>
                                </dl>
                                {g.signature_data && (
                                    <div className="mt-2">
                                        <p className="mb-1 text-xs text-muted">
                                            Signature
                                        </p>
                                        <img
                                            src={g.signature_data}
                                            alt={`Signature of ${g.signer_name || "the signer"}`}
                                            className="max-h-28 rounded border border-line bg-white p-1"
                                        />
                                    </div>
                                )}
                                {n && (
                                    <div className="mt-3">
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setShowNotice((v) => !v)
                                            }
                                            aria-expanded={showNotice}
                                            className="text-sm text-clinical-600 underline underline-offset-2"
                                        >
                                            {showNotice
                                                ? "Hide what they agreed to"
                                                : "Show what they agreed to"}
                                        </button>
                                        {showNotice && (
                                            <div className="mt-2 rounded border border-line bg-paper p-3 text-sm text-ink">
                                                {n.title && (
                                                    <p className="font-medium">
                                                        {n.title}
                                                    </p>
                                                )}
                                                {n.intro && (
                                                    <p className="mt-1 text-muted">
                                                        {n.intro}
                                                    </p>
                                                )}
                                                {(n.sections || []).map((s) => (
                                                    <div
                                                        key={s.heading}
                                                        className="mt-3"
                                                    >
                                                        <p className="font-medium">
                                                            {s.heading}
                                                        </p>
                                                        {s.text && (
                                                            <p className="mt-0.5">
                                                                {s.text}
                                                            </p>
                                                        )}
                                                        {Array.isArray(
                                                            s.items,
                                                        ) && (
                                                            <ul className="mt-0.5 list-disc pl-5">
                                                                {s.items.map(
                                                                    (it) => (
                                                                        <li
                                                                            key={
                                                                                it
                                                                            }
                                                                        >
                                                                            {it}
                                                                        </li>
                                                                    ),
                                                                )}
                                                            </ul>
                                                        )}
                                                    </div>
                                                ))}
                                                {n.agreeText && (
                                                    <p className="mt-3 italic">
                                                        “{n.agreeText}”
                                                    </p>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </section>
                        ) : (
                            <p className="text-sm text-muted">
                                This patient has not agreed to a consent notice
                                yet.
                            </p>
                        )}

                        {rec.history?.length > 1 && (
                            <section className="mt-4">
                                <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted">
                                    History
                                </p>
                                <ul className="divide-y divide-line text-sm">
                                    {rec.history.map((h, i) => (
                                        <li
                                            key={i}
                                            className="flex flex-wrap justify-between gap-x-3 py-1.5"
                                        >
                                            <span className="text-ink">
                                                {DECISION[h.decision] ||
                                                    h.decision}
                                                {h.signer_name
                                                    ? ` · ${h.signer_name}`
                                                    : ""}
                                                <span className="text-muted">
                                                    {" "}
                                                    · v{h.notice_version}
                                                </span>
                                            </span>
                                            <span className="text-muted">
                                                {when(h.at)}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            </section>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
