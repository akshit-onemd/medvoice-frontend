import React, { useEffect, useState } from "react";
import {
    ArrowLeft,
    ChevronDown,
    Download,
    FileClock,
    Loader2,
    Plus,
    ShieldCheck,
} from "lucide-react";
import ResultView from "./ResultView";
import { AIOverviewCard } from "./sections/shared";
import {
    getPatientConsultations,
    getPatientSummary,
    getConsultation,
} from "../api/processAudio";
import { downloadConsultationPdf } from "../utils/downloadConsultationPdf";
import useConsent from "../hooks/useConsent";
import ConsentFlow from "./ConsentFlow";
import ConsentBadge from "./ConsentBadge";
import PatientDetails from "./PatientDetails";

const EMPTY_SUMMARY = { overview: "", details: [] };

export default function PatientRecords({ patient, onBack, onNewVisit }) {
    const [consultations, setConsultations] = useState([]);
    const [loadingConsultations, setLoadingConsultations] = useState(true);
    const [patientSummary, setPatientSummary] = useState(EMPTY_SUMMARY);
    const [loadingSummary, setLoadingSummary] = useState(true);
    const [activeResult, setActiveResult] = useState(null);
    const [openingId, setOpeningId] = useState(null);
    const [downloadingId, setDownloadingId] = useState(null);
    const [error, setError] = useState("");
    const [consent, setConsent] = useConsent(patient.id);
    const [showConsent, setShowConsent] = useState(false);
    const [showDetails, setShowDetails] = useState(false);

    useEffect(() => {
        let cancelled = false;
        setError("");
        setActiveResult(null);
        setConsultations([]);
        setPatientSummary(EMPTY_SUMMARY);
        setLoadingConsultations(true);
        setLoadingSummary(true);

        getPatientConsultations(patient.id)
            .then((d) => !cancelled && setConsultations(d))
            .catch((err) => !cancelled && setError(err.message))
            .finally(() => !cancelled && setLoadingConsultations(false));

        getPatientSummary(patient.id)
            .then((s) => !cancelled && setPatientSummary(s))
            .catch(() => !cancelled && setPatientSummary(EMPTY_SUMMARY))
            .finally(() => !cancelled && setLoadingSummary(false));

        return () => {
            cancelled = true;
        };
    }, [patient.id]);

    useEffect(() => {
        window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    }, [activeResult]);

    const openConsultation = async (id) => {
        if (openingId) return; // ignore clicks while one is already opening
        setOpeningId(id);
        setError("");
        try {
            setActiveResult(await getConsultation(id));
        } catch (err) {
            setError(err.message);
        } finally {
            setOpeningId(null);
        }
    };

    const downloadConsultation = async (id) => {
        setDownloadingId(id);
        setError("");
        try {
            const full = await getConsultation(id);
            await downloadConsultationPdf(full);
        } catch (err) {
            setError(err.message || "Couldn't generate the PDF.");
        } finally {
            setDownloadingId(null);
        }
    };

    if (activeResult) {
        return (
            <ResultView
                result={activeResult}
                onReset={() => setActiveResult(null)}
            />
        );
    }

    return (
        <div className="w-full max-w-2xl mx-auto">
            <div className="bg-surface border border-line rounded-md shadow-panel p-2">
                <div className="flex items-center gap-3 rounded border border-clinical-500 bg-clinical-50 px-4 py-3 mb-6">
                    <button
                        type="button"
                        onClick={onBack}
                        aria-label="Back"
                        title="Back"
                        className="shrink-0 inline-flex h-8 w-8 items-center justify-center rounded border border-clinical-500 text-clinical-600 hover:bg-clinical-500 hover:text-paper transition-colors"
                    >
                        <ArrowLeft size={16} strokeWidth={1.75} />
                    </button>
                    <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-2 text-base text-ink">
                            <span className="truncate">{patient.name}</span>
                            <ConsentBadge status={consent} />
                        </p>
                        <p className="text-sm text-muted truncate">
                            {[
                                patient.age != null && `${patient.age}y`,
                                patient.gender,
                                patient.phone,
                            ]
                                .filter(Boolean)
                                .join(" · ")}
                        </p>
                    </div>
                    {consent && consent !== "valid" && (
                        <button
                            type="button"
                            onClick={() => setShowConsent(true)}
                            className="shrink-0 inline-flex items-center gap-1 rounded bg-clinical-500 px-3 py-2 text-xs font-medium text-paper hover:bg-clinical-600"
                        >
                            <ShieldCheck size={14} />
                            {consent === "outdated"
                                ? "Re-sign"
                                : "Collect consent"}
                        </button>
                    )}
                    {onNewVisit && (
                        <button
                            type="button"
                            onClick={onNewVisit}
                            className="shrink-0 inline-flex items-center gap-1 rounded border border-clinical-500 bg-surface px-3 py-2 text-xs font-medium text-clinical-600 hover:bg-clinical-500 hover:text-paper transition-colors"
                        >
                            <Plus size={14} strokeWidth={2} />
                            New visit
                        </button>
                    )}
                </div>

                <div className="-mt-3 mb-6">
                    <button
                        type="button"
                        onClick={() => setShowDetails((v) => !v)}
                        aria-expanded={showDetails}
                        className="inline-flex items-center gap-1 px-1 text-xs font-medium text-clinical-600 underline underline-offset-2"
                    >
                        <ChevronDown
                            size={14}
                            strokeWidth={1.75}
                            className={`transition-transform ${showDetails ? "rotate-180" : ""}`}
                        />
                        {showDetails ? "Hide details" : "View all details"}
                    </button>
                    {showDetails && (
                        <div className="mt-2 rounded border border-line bg-paper p-4">
                            <PatientDetails
                                patient={patient}
                                consent={consent}
                            />
                        </div>
                    )}
                </div>

                {loadingSummary && (
                    <p className="text-sm text-muted mb-4">Loading summary…</p>
                )}
                {!loadingSummary &&
                    (patientSummary.overview ||
                        patientSummary.details?.length > 0) && (
                        <div className="mb-6">
                            <AIOverviewCard
                                overview={patientSummary.overview}
                                details={patientSummary.details}
                            />
                        </div>
                    )}
                <h3 className="font-serif text-base text-ink mb-2">
                    Past visits
                </h3>
                {loadingConsultations && (
                    <p className="text-sm text-muted">Loading records…</p>
                )}
                {!loadingConsultations && consultations.length === 0 && (
                    <p className="text-sm text-muted">
                        No consultations recorded for this patient yet.
                    </p>
                )}

                {!loadingConsultations && consultations.length > 0 && (
                    <ul className="space-y-2">
                        {consultations.map((c) => (
                            <li key={c.id} className="flex items-stretch gap-2">
                                <button
                                    type="button"
                                    onClick={() => openConsultation(c.id)}
                                    aria-busy={openingId === c.id}
                                    className={`min-w-0 flex-1 flex items-center gap-3 rounded border px-4 py-3 text-left ${
                                        openingId === c.id
                                            ? "border-clinical-500 bg-clinical-50"
                                            : "border-line bg-paper hover:bg-clinical-50"
                                    } ${openingId ? "cursor-wait" : ""}`}
                                >
                                    {openingId === c.id ? (
                                        <Loader2
                                            size={16}
                                            className="text-clinical-600 shrink-0 animate-spin"
                                            strokeWidth={1.75}
                                        />
                                    ) : (
                                        <FileClock
                                            size={16}
                                            className="text-clinical-600 shrink-0"
                                            strokeWidth={1.75}
                                        />
                                    )}
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm text-ink truncate">
                                            {c.summary || "Consultation"}
                                        </p>
                                        <p className="text-xs text-muted">
                                            {new Date(c.created_at)
                                                .toLocaleString("en-IN", {
                                                    day: "2-digit",
                                                    month: "short",
                                                    year: "numeric",
                                                    hour: "2-digit",
                                                    minute: "2-digit",
                                                    hour12: true,
                                                })
                                                .replace(",", " -")}
                                        </p>
                                    </div>
                                </button>
                                {/* <button
                                    type="button"
                                    onClick={() => downloadConsultation(c.id)}
                                    disabled={downloadingId === c.id}
                                    aria-label="Download PDF"
                                    title="Download PDF"
                                    className="shrink-0 inline-flex items-center justify-center rounded border border-line bg-paper px-3 text-clinical-600 hover:bg-clinical-50 disabled:opacity-50"
                                >
                                    {downloadingId === c.id ? (
                                        <Loader2
                                            size={16}
                                            className="animate-spin"
                                            strokeWidth={1.75}
                                        />
                                    ) : (
                                        <Download
                                            size={16}
                                            strokeWidth={1.75}
                                        />
                                    )}
                                </button> */}
                            </li>
                        ))}
                    </ul>
                )}

                {error && (
                    <p className="mt-4 text-sm text-alert-500">{error}</p>
                )}
            </div>
            {showConsent && (
                <ConsentFlow
                    patient={patient}
                    onCancel={() => setShowConsent(false)}
                    onDone={(status) => {
                        setConsent(status);
                        setShowConsent(false);
                    }}
                />
            )}
        </div>
    );
}
