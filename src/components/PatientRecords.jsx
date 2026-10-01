import React, { useEffect, useState } from "react";
import { ChevronLeft, Download, FileClock, Loader2 } from "lucide-react";
import ResultView from "./ResultView";
import { AIOverviewCard } from "./sections/shared";
import {
    getPatientConsultations,
    getPatientSummary,
    getConsultation,
} from "../api/processAudio";
import { downloadConsultationPdf } from "../utils/downloadConsultationPdf";

const EMPTY_SUMMARY = { overview: "", details: [] };

export default function PatientRecords({ patient, onBack }) {
    const [consultations, setConsultations] = useState([]);
    const [loadingConsultations, setLoadingConsultations] = useState(true);
    const [patientSummary, setPatientSummary] = useState(EMPTY_SUMMARY);
    const [loadingSummary, setLoadingSummary] = useState(true);
    const [activeResult, setActiveResult] = useState(null);
    const [loadingRecord, setLoadingRecord] = useState(false);
    const [downloadingId, setDownloadingId] = useState(null);
    const [error, setError] = useState("");

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
        setLoadingRecord(true);
        setError("");
        try {
            setActiveResult(await getConsultation(id));
        } catch (err) {
            setError(err.message);
        } finally {
            setLoadingRecord(false);
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
                    <div className="flex-1">
                        <p className="text-base text-ink">{patient.name}</p>
                        <p className="text-sm text-muted">
                            {[
                                patient.age && `${patient.age}y`,
                                patient.gender,
                                patient.phone,
                            ]
                                .filter(Boolean)
                                .join(" · ")}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onBack}
                        className="text-xs text-clinical-600 underline underline-offset-2 shrink-0"
                    >
                        <span className="inline-flex items-center gap-1">
                            <ChevronLeft size={12} />
                            Back to search
                        </span>
                    </button>
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
                                    disabled={loadingRecord}
                                    className="min-w-0 flex-1 flex items-center gap-3 rounded border border-line bg-paper px-4 py-3 text-left hover:bg-clinical-50 disabled:opacity-50"
                                >
                                    <FileClock
                                        size={16}
                                        className="text-clinical-600 shrink-0"
                                        strokeWidth={1.75}
                                    />
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
                                <button
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
                                </button>
                            </li>
                        ))}
                    </ul>
                )}

                {error && (
                    <p className="mt-4 text-sm text-alert-500">{error}</p>
                )}
            </div>
        </div>
    );
}
