import React, { useState } from "react";
import { ChevronDown, RotateCcw, Stethoscope } from "lucide-react";
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
                <TopBar onReset={onReset} language={result?.language} />
                <div className="bg-surface border border-line rounded-md shadow-panel p-6">
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

    return (
        <div className="w-full max-w-5xl mx-auto">
            <TopBar onReset={onReset} language={result?.language} />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <VitalsCard vitals={data.vitals} />
                <AllergiesCard allergies={data.allergies} />
                <ConditionsCard conditions={data.conditions} />
                <MedicationsCard medications={data.medication_history} />
                <InvestigationsCard
                    investigations={data.investigation_history}
                />
                <ProceduresCard procedures={data.procedures} />
                <SystemReviewCard systemReview={data.system_review} />
                <FamilyHistoryCard familyHistory={data.family_history} />
                <LifestyleCard lifestyle={data.lifestyle_habits} />
                <SocialHistoryCard socialHistory={data.social_history} />
                <OtherHistoryCard otherHistory={data.other_history} />
            </div>
            {data.prescription && (
                <div className="mt-5">
                    <PrescriptionCard prescription={data.prescription} />
                </div>
            )}
            {result?.saved && (
                <p className="text-xs text-muted mt-1">
                    Saved to {result.saved.patient_name}'s record
                </p>
            )}
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
                        <div className="px-6 pb-6">
                            <p className="text-sm text-ink/80 leading-relaxed whitespace-pre-wrap">
                                {result.transcript}
                            </p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

function TopBar({ onReset, language }) {
    return (
        <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded bg-clinical-500 text-paper">
                    <Stethoscope size={18} strokeWidth={1.75} />
                </div>
                <div>
                    <h1 className="font-serif text-xl text-ink leading-tight">
                        Consultation summary
                    </h1>
                    {language && (
                        <p className="text-xs text-muted">
                            Detected language: {language.toUpperCase()}
                        </p>
                    )}
                </div>
            </div>
            <button
                type="button"
                onClick={onReset}
                className="inline-flex items-center gap-2 rounded border border-line bg-surface px-3.5 py-2 text-sm text-ink hover:bg-paper transition-colors"
            >
                <RotateCcw size={14} strokeWidth={1.75} />
                New consultation
            </button>
        </div>
    );
}
