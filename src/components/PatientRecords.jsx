import React, { useEffect, useState } from "react";
import {
    ChevronLeft,
    Download,
    FileClock,
    Loader2,
    Stethoscope,
    User,
} from "lucide-react";
import ResultView from "./ResultView";
import { AIOverviewCard, SummaryCard } from "./sections/shared";
import {
    searchPatients,
    getPatientConsultations,
    getPatientSummary,
    getConsultation,
} from "../api/processAudio";
import { downloadConsultationPdf } from "../utils/downloadConsultationPdf";
import SearchInput from "./SearchInput";

export default function PatientRecords() {
    const [query, setQuery] = useState("");
    const [results, setResults] = useState([]);
    const [searching, setSearching] = useState(false);
    const [selectedPatient, setSelectedPatient] = useState(null);
    const [consultations, setConsultations] = useState([]);
    const [loadingConsultations, setLoadingConsultations] = useState(false);
    const [activeResult, setActiveResult] = useState(null);
    const [loadingRecord, setLoadingRecord] = useState(false);
    const [patientSummary, setPatientSummary] = useState({
        overview: "",
        details: [],
    });
    const [loadingSummary, setLoadingSummary] = useState(false);
    const [downloadingId, setDownloadingId] = useState(null);
    const [error, setError] = useState("");

    useEffect(() => {
        const q = query.trim();
        if (q.length < 2) {
            setResults([]);
            setSearching(false);
            return;
        }
        setSearching(true);
        const controller = new AbortController();
        const handle = setTimeout(async () => {
            try {
                setResults(await searchPatients(q, controller.signal));
            } catch (err) {
                if (err.name === "AbortError") return; // superseded by a newer keystroke
                setResults([]);
            } finally {
                if (!controller.signal.aborted) setSearching(false);
            }
        }, 300);
        return () => {
            clearTimeout(handle);
            controller.abort();
        };
    }, [query]);
    useEffect(() => {
        window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    }, [activeResult]);
    const selectPatient = async (p) => {
        setSelectedPatient(p);
        setQuery("");
        setResults([]);
        setActiveResult(null);
        setError("");
        setLoadingConsultations(true);
        setLoadingSummary(true);
        setPatientSummary({ overview: "", details: [] });
        getPatientConsultations(p.id)
            .then(setConsultations)
            .catch((err) => setError(err.message))
            .finally(() => setLoadingConsultations(false));

        getPatientSummary(p.id)
            .then(setPatientSummary)
            .catch(() => setPatientSummary({ overview: "", details: [] }))
            .finally(() => setLoadingSummary(false));
    };

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
    }; // Viewing a specific record — reuse ResultView as-is.
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
            {/* <div className="flex items-center gap-3 mb-8">
                <div className="flex h-10 w-10 items-center justify-center rounded bg-clinical-500 text-paper">
                    <Stethoscope size={20} strokeWidth={1.75} />
                </div>
                <div>
                    <h1 className="font-serif text-2xl text-ink leading-tight">
                        Patient Records
                    </h1>
                    <p className="text-sm text-muted">
                        Search a patient to view their past consultations
                    </p>
                </div>
            </div> */}

            <div className="bg-surface border border-line rounded-md shadow-panel p-2">
                {selectedPatient ? (
                    <>
                        <div className="flex items-center gap-3 rounded border border-clinical-500 bg-clinical-50 px-4 py-3 mb-6">
                            <div className="flex-1">
                                <p className="text-base text-ink">
                                    {selectedPatient.name}
                                </p>
                                <p className="text-sm text-muted">
                                    {[
                                        selectedPatient.age &&
                                            `${selectedPatient.age}y`,
                                        selectedPatient.gender,
                                        selectedPatient.phone,
                                    ]
                                        .filter(Boolean)
                                        .join(" · ")}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    setSelectedPatient(null);
                                    setConsultations([]);
                                }}
                                className="text-xs text-clinical-600 underline underline-offset-2 shrink-0"
                            >
                                <span className="inline-flex items-center gap-1">
                                    <ChevronLeft size={12} />
                                    Change patient
                                </span>
                            </button>
                        </div>
                        {loadingSummary && (
                            <p className="text-sm text-muted mb-4">
                                Loading summary…
                            </p>
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
                            <p className="text-sm text-muted">
                                Loading records…
                            </p>
                        )}

                        {!loadingConsultations &&
                            consultations.length === 0 && (
                                <p className="text-sm text-muted">
                                    No consultations recorded for this patient
                                    yet.
                                </p>
                            )}

                        {!loadingConsultations && consultations.length > 0 && (
                            <ul className="space-y-2">
                                {consultations.map((c) => (
                                    <li
                                        key={c.id}
                                        className="flex items-stretch gap-2"
                                    >
                                        <button
                                            type="button"
                                            onClick={() =>
                                                openConsultation(c.id)
                                            }
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
                                                    {c.summary ||
                                                        "Consultation"}
                                                </p>
                                                <p className="text-xs text-muted">
                                                    {new Date(c.created_at)
                                                        .toLocaleString(
                                                            "en-IN",
                                                            {
                                                                day: "2-digit",
                                                                month: "short",
                                                                year: "numeric",
                                                                hour: "2-digit",
                                                                minute: "2-digit",
                                                                hour12: true,
                                                            },
                                                        )
                                                        .replace(",", " -")}
                                                </p>
                                            </div>
                                        </button>
                                        {/* <button
                                            type="button"
                                            onClick={() =>
                                                downloadConsultation(c.id)
                                            }
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
                    </>
                ) : (
                    <div>
                        <div className="flex items-center gap-2 mb-4">
                            <User
                                size={16}
                                className="text-clinical-600"
                                strokeWidth={1.75}
                            />
                            <h2 className="font-serif text-xl text-ink">
                                Find a patient
                            </h2>
                        </div>
                        {/* <input
                            type="text"
                            placeholder="Search by name or phone"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            autoFocus
                            className="w-full rounded border border-line bg-paper px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-clinical-500 outline-none"
                        /> */}
                        <SearchInput
                            value={query}
                            onChange={setQuery}
                            placeholder="Search by name or phone"
                            autoFocus
                            inputClassName="w-full rounded border border-line bg-paper px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-clinical-500 outline-none"
                        />
                        {searching && (
                            <p className="text-xs text-muted mt-2">
                                Searching…
                            </p>
                        )}
                        {results.length > 0 && (
                            <ul className="mt-2 rounded border border-line divide-y divide-line overflow-hidden">
                                {results.map((p) => (
                                    <li key={p.id}>
                                        <button
                                            type="button"
                                            onClick={() => selectPatient(p)}
                                            className="w-full text-left px-3 py-2.5 hover:bg-paper"
                                        >
                                            <p className="text-sm text-ink">
                                                {p.name}
                                            </p>
                                            <p className="text-xs text-muted">
                                                {[
                                                    p.age && `${p.age}y`,
                                                    p.gender,
                                                    p.phone,
                                                ]
                                                    .filter(Boolean)
                                                    .join(" · ")}
                                            </p>
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                        {query.trim().length >= 2 &&
                            !searching &&
                            results.length === 0 && (
                                <p className="text-xs text-muted mt-2">
                                    No matching patient found.
                                </p>
                            )}
                    </div>
                )}

                {error && (
                    <p className="mt-4 text-sm text-alert-500">{error}</p>
                )}
            </div>
        </div>
    );
}
