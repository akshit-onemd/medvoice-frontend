import React, { useEffect, useState } from "react";
import { ChevronLeft, FileClock, Stethoscope, User } from "lucide-react";
import ResultView from "./ResultView";
import {
    searchPatients,
    getPatientConsultations,
    getConsultation,
} from "../api/processAudio";

export default function PatientRecords() {
    const [query, setQuery] = useState("");
    const [results, setResults] = useState([]);
    const [searching, setSearching] = useState(false);
    const [selectedPatient, setSelectedPatient] = useState(null);
    const [consultations, setConsultations] = useState([]);
    const [loadingConsultations, setLoadingConsultations] = useState(false);
    const [activeResult, setActiveResult] = useState(null);
    const [loadingRecord, setLoadingRecord] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        if (query.trim().length < 2) {
            setResults([]);
            return;
        }
        setSearching(true);
        const handle = setTimeout(async () => {
            try {
                setResults(await searchPatients(query.trim()));
            } catch {
                setResults([]);
            } finally {
                setSearching(false);
            }
        }, 350);
        return () => clearTimeout(handle);
    }, [query]);

    const selectPatient = async (p) => {
        setSelectedPatient(p);
        setQuery("");
        setResults([]);
        setActiveResult(null);
        setError("");
        setLoadingConsultations(true);
        try {
            setConsultations(await getPatientConsultations(p.id));
        } catch (err) {
            setError(err.message);
        } finally {
            setLoadingConsultations(false);
        }
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

    // Viewing a specific record — reuse ResultView as-is.
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
            <div className="flex items-center gap-3 mb-8">
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
            </div>

            <div className="bg-surface border border-line rounded-md shadow-panel p-8">
                {selectedPatient ? (
                    <>
                        <div className="flex items-center gap-3 rounded border border-clinical-500 bg-clinical-50 px-4 py-3 mb-6">
                            <div className="flex-1">
                                <p className="text-sm text-ink">
                                    {selectedPatient.name}
                                </p>
                                <p className="text-xs text-muted">
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
                                    <li key={c.id}>
                                        <button
                                            type="button"
                                            onClick={() =>
                                                openConsultation(c.id)
                                            }
                                            disabled={loadingRecord}
                                            className="w-full flex items-center gap-3 rounded border border-line bg-paper px-4 py-3 text-left hover:bg-clinical-50 disabled:opacity-50"
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
                                                        .replace(
                                                            ",",
                                                            " -",
                                                        )}{" "}
                                                </p>
                                            </div>
                                        </button>
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
                            <h2 className="font-serif text-lg text-ink">
                                Find a patient
                            </h2>
                        </div>
                        <input
                            type="text"
                            placeholder="Search by name or phone"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            className="w-full rounded border border-line bg-paper px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-clinical-500 outline-none"
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
