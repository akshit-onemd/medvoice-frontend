import React, { useEffect, useRef, useState } from "react";
import { X, Loader2, CheckCircle2 } from "lucide-react";
import SignaturePad from "./SignaturePad";
import { getConsentNotice, submitConsent } from "../api/consent";

const SIGNERS = [
    { key: "self", label: "Patient signs" },
    { key: "guardian", label: "Parent / guardian signs" },
    { key: "representative", label: "Signed on patient's behalf" },
];

const input =
    "w-full rounded border border-line bg-paper px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-clinical-500 outline-none";

// Full-screen, two steps: 1) read the notice  2) sign.
// props: patient {id,name,age}, onDone(statusString), onCancel()
export default function ConsentFlow({ patient, onDone, onCancel }) {
    const isMinor = patient.age != null && Number(patient.age) < 18;

    const [step, setStep] = useState(1);
    const [notice, setNotice] = useState(null); // { hash, version, notice }
    const [loadError, setLoadError] = useState("");
    const [reachedEnd, setReachedEnd] = useState(false);
    const endRef = useRef(null);

    const [signerType, setSignerType] = useState(isMinor ? "guardian" : "self");
    const [signerName, setSignerName] = useState(isMinor ? "" : patient.name);
    const [relationship, setRelationship] = useState("");
    const [reason, setReason] = useState("");
    const [signature, setSignature] = useState(null);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [done, setDone] = useState(false);

    const loadNotice = async () => {
        setLoadError("");
        setNotice(null);
        setReachedEnd(false);
        try {
            setNotice(await getConsentNotice());
        } catch (err) {
            setLoadError(err.message || "Couldn't load the consent notice.");
        }
    };
    useEffect(() => {
        loadNotice();
    }, []);

    // Unlock "Continue" once the end of the notice has been on screen.
    useEffect(() => {
        if (step !== 1 || !notice || !endRef.current) return;
        const io = new IntersectionObserver(
            ([e]) => e.isIntersecting && setReachedEnd(true),
            { threshold: 1 },
        );
        io.observe(endRef.current);
        return () => io.disconnect();
    }, [step, notice]);

    const pickSigner = (key) => {
        setSignerType(key);
        setSignerName(key === "self" ? patient.name : "");
        setRelationship("");
        setReason("");
    };

    const canSign =
        !!signature &&
        signerName.trim() &&
        (signerType === "self" || relationship.trim()) &&
        (signerType !== "representative" || reason.trim());

    const send = async (payload) => {
        setSaving(true);
        setError("");
        try {
            const out = await submitConsent(patient.id, {
                notice_hash: notice.hash,
                ...payload,
            });
            setDone(true);
            setTimeout(() => onDone?.(out.status), 900);
        } catch (err) {
            if (err.code === "NOTICE_CHANGED") {
                await loadNotice();
                setStep(1);
                setError(
                    "The consent notice was just updated. Please read the new version.",
                );
            } else {
                setError(err.message || "Couldn't save. Try again.");
            }
        } finally {
            setSaving(false);
        }
    };

    const sign = () =>
        send({
            decision: "granted",
            signer_type: signerType,
            signer_name: signerName.trim(),
            signer_relationship: relationship.trim(),
            on_behalf_reason: reason.trim(),
            signature_data: signature,
        });

    const n = notice?.notice;

    return (
        <div className="fixed inset-0 z-[70] overflow-y-auto bg-paper">
            <div className="mx-auto w-full max-w-2xl px-4 pb-16 pt-6">
                {/* header */}
                <div className="mb-6 flex items-start justify-between gap-3">
                    <div>
                        <p className="text-xs text-muted">
                            Step {step} of 2 · {step === 1 ? "View" : "Sign"}
                        </p>
                        <h2 className="font-serif text-xl text-ink">
                            Consent for {patient.name}
                        </h2>
                    </div>
                    <button
                        type="button"
                        onClick={onCancel}
                        aria-label="Close"
                        className="shrink-0 rounded border border-line p-2 text-muted hover:text-ink"
                    >
                        <X size={16} />
                    </button>
                </div>
                <div className="mb-6 flex gap-2">
                    {[1, 2].map((s) => (
                        <div
                            key={s}
                            className={`h-1 flex-1 rounded ${s <= step ? "bg-clinical-500" : "bg-line"}`}
                        />
                    ))}
                </div>

                {done ? (
                    <div className="flex flex-col items-center gap-2 py-16 text-clinical-600">
                        <CheckCircle2 size={40} strokeWidth={1.5} />
                        <p className="font-serif text-lg text-ink">Recorded</p>
                    </div>
                ) : loadError ? (
                    <div className="rounded border border-line bg-surface p-6">
                        <p className="mb-3 text-sm text-alert-500">
                            {loadError}
                        </p>
                        <button
                            type="button"
                            onClick={loadNotice}
                            className="text-sm text-clinical-600 underline underline-offset-2"
                        >
                            Try again
                        </button>
                    </div>
                ) : !n ? (
                    <p className="flex items-center gap-2 text-sm text-muted">
                        <Loader2 size={14} className="animate-spin" /> Loading…
                    </p>
                ) : step === 1 ? (
                    <>
                        <div className="rounded-md border border-line bg-surface p-6 shadow-panel">
                            <h3 className="mb-2 font-serif text-2xl text-ink">
                                {n.title}
                            </h3>
                            <p className="mb-6 text-base text-ink/80">
                                {n.intro}
                            </p>
                            {n.sections.map((s) => (
                                <div key={s.heading} className="mb-5">
                                    <h4 className="mb-1.5 text-sm font-medium uppercase tracking-wide text-clinical-600">
                                        {s.heading}
                                    </h4>
                                    {s.text && (
                                        <p className="text-base leading-relaxed text-ink">
                                            {s.text}
                                        </p>
                                    )}
                                    {s.items && (
                                        <ul className="list-disc space-y-1.5 pl-5 text-base leading-relaxed text-ink">
                                            {s.items.map((it) => (
                                                <li key={it}>{it}</li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            ))}
                            <p className="text-sm text-muted">{n.minorText}</p>
                            <p className="mt-3 text-xs text-muted">
                                Notice version {notice.version}
                            </p>
                            <div ref={endRef} className="h-px" />
                        </div>
                        {error && (
                            <p className="mt-4 text-sm text-alert-500">
                                {error}
                            </p>
                        )}
                        <button
                            type="button"
                            onClick={() => {
                                setError("");
                                setStep(2);
                            }}
                            disabled={!reachedEnd}
                            className="mt-6 w-full rounded bg-clinical-500 py-3 text-base font-medium text-paper transition-colors hover:bg-clinical-600 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            {reachedEnd
                                ? "Continue to sign"
                                : "Scroll to the end to continue"}
                        </button>
                    </>
                ) : (
                    <>
                        <div className="rounded-md border border-line bg-surface p-6 shadow-panel">
                            <p className="mb-4 text-base text-ink">
                                {n.agreeText}
                            </p>

                            <div className="mb-4 flex flex-wrap gap-2">
                                {SIGNERS.map((s) => {
                                    const disabled =
                                        isMinor && s.key === "self";
                                    return (
                                        <button
                                            key={s.key}
                                            type="button"
                                            disabled={disabled}
                                            onClick={() => pickSigner(s.key)}
                                            className={`rounded border px-3 py-1.5 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                                                signerType === s.key
                                                    ? "border-clinical-500 bg-clinical-50 text-clinical-600"
                                                    : "border-line bg-paper text-ink hover:bg-clinical-50"
                                            }`}
                                        >
                                            {s.label}
                                        </button>
                                    );
                                })}
                            </div>
                            {isMinor && (
                                <p className="mb-3 text-xs text-muted">
                                    Patient is under 18, so a parent or guardian
                                    must sign.
                                </p>
                            )}

                            <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <input
                                    className={input}
                                    placeholder="Signer's full name"
                                    value={signerName}
                                    onChange={(e) =>
                                        setSignerName(e.target.value)
                                    }
                                />
                                {signerType !== "self" && (
                                    <input
                                        className={input}
                                        placeholder="Relationship to patient"
                                        value={relationship}
                                        onChange={(e) =>
                                            setRelationship(e.target.value)
                                        }
                                    />
                                )}
                                {signerType === "representative" && (
                                    <input
                                        className={`${input} sm:col-span-2`}
                                        placeholder="Why can't the patient sign?"
                                        value={reason}
                                        onChange={(e) =>
                                            setReason(e.target.value)
                                        }
                                    />
                                )}
                            </div>

                            <SignaturePad onChange={setSignature} />
                        </div>

                        {error && (
                            <p className="mt-4 text-sm text-alert-500">
                                {error}
                            </p>
                        )}

                        <button
                            type="button"
                            onClick={sign}
                            disabled={!canSign || saving}
                            className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded bg-clinical-500 py-3 text-base font-medium text-paper transition-colors hover:bg-clinical-600 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            {saving && (
                                <Loader2 size={16} className="animate-spin" />
                            )}
                            I agree and sign
                        </button>

                        <div className="mt-4 text-sm">
                            <button
                                type="button"
                                onClick={() => setStep(1)}
                                className="text-clinical-600 underline underline-offset-2"
                            >
                                Back to notice
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
