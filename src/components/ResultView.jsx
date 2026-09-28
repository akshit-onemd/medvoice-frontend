import React, { useState } from "react";
import {
    ArrowLeft,
    ChevronDown,
    RotateCcw,
    Stethoscope,
    Download,
} from "lucide-react";
import { VitalsCard, AllergiesCard } from "./sections/VitalsAndAllergies";
import {
    ConditionsCard,
    ProceduresCard,
    SystemReviewCard,
} from "./sections/ConditionsAndProcedures";
import {
    MedicationsCard,
    InvestigationsCard,
} from "./sections/MedicationsAndInvestigations";
import {
    FamilyHistoryCard,
    LifestyleCard,
    SocialHistoryCard,
    OtherHistoryCard,
} from "./sections/HistoryCards";
import { PrescriptionCard } from "./sections/PrescriptionCards";
import { AIOverviewCard, SummaryCard } from "./sections/shared";
import { downloadConsultationPdf } from "../utils/downloadConsultationPdf";
import BrandMark from "./BrandMark";

// Treats null/undefined, empty arrays, empty objects, and blank strings as "no data".
function isEmptyValue(v) {
    if (v === null || v === undefined) return true;
    if (Array.isArray(v)) return v.length === 0;
    if (typeof v === "object") return Object.keys(v).length === 0;
    if (typeof v === "string") return v.trim() === "";
    return false;
}
export default function ResultView({ result, onReset }) {
    const [showTranscript, setShowTranscript] = useState(false);
    const data = result?.structured_data || {};

    // If the model failed to return valid JSON, the backend falls back
    // to { raw_response: "..." }. Show that plainly instead of an empty chart.
    if (
        data.raw_response &&
        !Object.keys(data).some((k) => k !== "raw_response")
    ) {
        return (
            <div className="w-full max-w-2xl mx-auto">
                <TopBar
                    onReset={onReset}
                    language={result?.language}
                    onDownload={() => downloadConsultationPdf(result)}
                />
                <div className="bg-surface border border-line rounded-md shadow-panel p-2">
                    <h2 className="font-serif text-lg text-ink mb-2">
                        Couldn't structure this response
                    </h2>
                    <p className="text-sm text-muted mb-4">
                        The extraction model didn't return valid JSON. Here's
                        what it sent back instead:
                    </p>
                    <pre className="text-xs bg-paper border border-line rounded p-4 whitespace-pre-wrap text-ink/80">
                        {data.raw_response}
                    </pre>
                </div>
            </div>
        );
    }

    // vitals is always a fixed-length array of { name, units, value, loinc_code };
    // unrecorded vitals come back with value: "", so filter those out before
    // deciding whether the section has anything to show.
    const recordedVitals = (data.vitals || []).filter(
        (v) =>
            v?.value !== undefined &&
            v?.value !== null &&
            String(v.value).trim() !== "",
    );

    const sections = [
        {
            label: "Vitals",
            value: recordedVitals,
            render: () => <VitalsCard vitals={recordedVitals} />,
        },
        {
            label: "Allergies",
            value: data.allergies,
            render: () => <AllergiesCard allergies={data.allergies} />,
        },
        {
            label: "Conditions",
            value: data.conditions,
            render: () => <ConditionsCard conditions={data.conditions} />,
        },
        {
            label: "Medications",
            value: data.medication_history,
            render: () => (
                <MedicationsCard medications={data.medication_history} />
            ),
        },
        {
            label: "Investigations",
            value: data.investigation_history,
            render: () => (
                <InvestigationsCard
                    investigations={data.investigation_history}
                />
            ),
        },
        {
            label: "Procedures",
            value: data.procedures,
            render: () => <ProceduresCard procedures={data.procedures} />,
        },
        {
            label: "System review",
            value: data.system_review,
            render: () => (
                <SystemReviewCard systemReview={data.system_review} />
            ),
        },
        {
            label: "Family history",
            value: data.family_history,
            render: () => (
                <FamilyHistoryCard familyHistory={data.family_history} />
            ),
        },
        {
            label: "Lifestyle",
            value: data.lifestyle_habits,
            render: () => <LifestyleCard lifestyle={data.lifestyle_habits} />,
        },
        {
            label: "Social history",
            value: data.social_history,
            render: () => (
                <SocialHistoryCard socialHistory={data.social_history} />
            ),
        },
        {
            label: "Other history",
            value: data.other_history,
            render: () => (
                <OtherHistoryCard otherHistory={data.other_history} />
            ),
        },
    ];

    const filledSections = sections.filter((s) => !isEmptyValue(s.value));
    const emptySections = sections.filter((s) => isEmptyValue(s.value));

    return (
        // <div className="w-full max-w-5xl mx-auto">
        <div className="w-full max-w-2xl mx-auto">
            <TopBar
                onReset={onReset}
                language={result?.language}
                onDownload={() => downloadConsultationPdf(result)}
            />
            {(data.consultation_summary?.overview ||
                data.consultation_summary?.details?.length > 0) && (
                <div className="mb-5">
                    <AIOverviewCard
                        overview={data.consultation_summary?.overview}
                        details={data.consultation_summary?.details}
                    />
                </div>
            )}
            {/* {!isEmptyValue(data.consultation_summary) && (
                <div className="mb-5">
                    <AIOverviewCard
                        overview={data.consultation_summary.overview}
                        details={data.consultation_summary.details}
                    />
                </div>
            )} */}
            {/* <div className="columns-1 lg:columns-2 gap-5"> */}
            <div className="columns-1 gap-5">
                {filledSections.map((s) => (
                    <div key={s.label} className="break-inside-avoid mb-5">
                        {s.render()}
                    </div>
                ))}
            </div>
            {emptySections.length > 0 && (
                <div className="mt-5 bg-surface border border-line rounded-md px-5 py-4">
                    <p className="font-serif text-base text-ink leading-tight mb-4">
                        Not recorded
                    </p>
                    <div className="flex flex-wrap gap-2">
                        {emptySections.map((s) => (
                            <span
                                key={s.label}
                                className="inline-flex items-center rounded-full border border-line bg-paper px-2.5 py-1 text-sm"
                            >
                                {s.label}
                            </span>
                        ))}
                    </div>
                </div>
            )}
            {data.prescription && (
                <div className="mt-5">
                    <PrescriptionCard prescription={data.prescription} />
                </div>
            )}
            {/* {result?.saved && (
                <p className="text-xs text-muted mt-1">
                    Saved to {result.saved.patient_name}'s record
                </p>
            )} */}
            {result?.transcript && (
                <div className="mt-5 bg-surface border border-line rounded-md shadow-panel">
                    <button
                        type="button"
                        onClick={() => setShowTranscript((v) => !v)}
                        className="w-full flex items-center justify-between px-6 py-4 text-left"
                    >
                        <span className="font-serif text-base text-ink">
                            Full transcript
                        </span>
                        <ChevronDown
                            size={16}
                            className={`text-muted transition-transform ${showTranscript ? "rotate-180" : ""}`}
                        />
                    </button>
                    {showTranscript && (
                        <div className="px-6 pb-6 space-y-2">
                            {result.diarizedTranscript ? (
                                result.diarizedTranscript
                                    .split("\n")
                                    .map((line, i) => {
                                        const match =
                                            line.match(/^([^:]+):\s*(.*)$/);
                                        return (
                                            <p
                                                key={i}
                                                className="text-sm text-ink/80 leading-relaxed"
                                            >
                                                {match ? (
                                                    <>
                                                        <span className="font-medium text-ink">
                                                            {match[1]}:
                                                        </span>
                                                        {match[2]}
                                                    </>
                                                ) : (
                                                    line
                                                )}
                                            </p>
                                        );
                                    })
                            ) : (
                                <p className="text-sm text-ink/80 leading-relaxed whitespace-pre-wrap">
                                    {result.transcript}
                                </p>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

function TopBar({ onReset, language, onDownload }) {
    return (
        <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
                {/* <div className="flex h-9 w-9 items-center justify-center rounded bg-clinical-500 text-paper">
                    <Stethoscope size={18} strokeWidth={1.75} />
                </div> */}
                {/* <BrandMark /> */}
                <div>
                    <h1 className="font-serif text-xl sm:text-2xl text-ink leading-tight">
                        Consultation summary
                    </h1>
                    {/* {language && (
                        <p className="text-xs text-muted">
                            Detected language: {language.toUpperCase()}
                        </p>
                    )} */}
                </div>
            </div>
            <div className="flex items-center gap-2">
                {onDownload && (
                    <button
                        type="button"
                        onClick={onDownload}
                        className="inline-flex items-center gap-2 rounded bg-clinical-500 px-2.5 py-2.5 text-sm text-paper hover:bg-clinical-600 transition-colors"
                    >
                        <Download size={16} strokeWidth={1.75} />
                        <span className="hidden sm:inline">
                            Download Summary
                        </span>
                    </button>
                )}
                <button
                    type="button"
                    onClick={onReset}
                    className="inline-flex items-center gap-2 rounded border border-line bg-surface px-2.5 py-2.5 text-sm text-ink hover:bg-paper transition-colors"
                >
                    <ArrowLeft size={16} strokeWidth={1.75} />
                    <span className="hidden sm:inline">Go Back</span>
                </button>
            </div>
        </div>
    );
}
