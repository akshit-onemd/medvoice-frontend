import React, { useEffect, useState } from "react";
import {
    ArrowLeft,
    ChevronDown,
    Download,
    FileClock,
    Loader2,
    Plus,
} from "lucide-react";
import ResultView from "./ResultView";
import { AIOverviewCard } from "./sections/shared";
import {
    usePatientVisits,
    usePatientSummary,
    loadConsultation,
    prefetchConsultations,
} from "../api/patientCache";
import { downloadConsultationPdf } from "../utils/downloadConsultationPdf";
import useConsent from "../hooks/useConsent";
import ConsentFlow from "./ConsentFlow";
import ConsentBadge from "./ConsentBadge";
import ConsentRecordDialog from "./ConsentRecordDialog";
import PatientDetails from "./PatientDetails";

const EMPTY_SUMMARY = { overview: "", details: [] };

export default function PatientRecords({
    patient: patientIn,
    onBack,
    onNewVisit,
}) {
    // Local copy, so edits made in "View all details" show in the header at once
    const [patient, setPatient] = useState(patientIn);
    useEffect(() => setPatient(patientIn), [patientIn]);
    const [showConsentRecord, setShowConsentRecord] = useState(false);
    // Shown at once from the last open of this patient, refreshed quietly
    const visits = usePatientVisits(patient.id);
    const summary = usePatientSummary(patient.id);
    const consultations = visits.data || [];
    const loadingConsultations = visits.loading;
    const patientSummary = summary.data || EMPTY_SUMMARY;
    const loadingSummary = summary.loading;
    const [activeResult, setActiveResult] = useState(null);
    const [openingId, setOpeningId] = useState(null);
    const [downloadingId, setDownloadingId] = useState(null);
    const [error, setError] = useState("");
    const [consent, setConsent] = useConsent(patient.id);
    const [showConsent, setShowConsent] = useState(false);
    const [showDetails, setShowDetails] = useState(false);

    useEffect(() => {
        setError("");
        setActiveResult(null);
    }, [patient.id]);
    useEffect(() => {
        if (visits.error && !visits.data) setError(visits.error.message);
    }, [visits.error, visits.data]);
    // Load the latest few notes in the background so opening them is instant
    const latestIds = consultations
        .slice(0, 3)
        .map((c) => c.id)
        .join(",");
    useEffect(() => {
        if (latestIds) prefetchConsultations(latestIds.split(","));
    }, [latestIds]);

    useEffect(() => {
        window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    }, [activeResult]);

    const openConsultation = async (id) => {
        if (openingId) return; // ignore clicks while one is already opening
        setOpeningId(id);
        setError("");
        try {
            setActiveResult(await loadConsultation(id));
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
            const full = await loadConsultation(id);
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
                onReset={() => {
                    setActiveResult(null);
                    // The note may have been edited: refresh the list and summary
                    visits.refresh().catch(() => {});
                    summary.refresh().catch(() => {});
                }}
            />
        );
    }

    return (
        <div className="w-full max-w-3xl mx-auto">
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
                        <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-base text-ink">
                            <span className="truncate">{patient.name}</span>
                            <ConsentBadge
                                status={consent}
                                hint
                                onClick={
                                    consent === "valid"
                                        ? () => setShowConsentRecord(true)
                                        : () => setShowConsent(true)
                                }
                            />
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
                                onSaved={(p) =>
                                    setPatient((s) => ({ ...s, ...p }))
                                }
                                onRecordConsent={() => setShowConsent(true)}
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
                <h3 className="font-display text-base text-ink mb-2">
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
            {showConsentRecord && (
                <ConsentRecordDialog
                    patient={patient}
                    onClose={() => setShowConsentRecord(false)}
                />
            )}
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
