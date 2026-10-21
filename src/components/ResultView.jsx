import React, { useEffect, useState } from "react";
import { ArrowLeft, ChevronDown, Download, Pencil } from "lucide-react";
import { VitalsCard, AllergiesCard } from "./sections/VitalsAndAllergies";
import { Receipt } from "lucide-react"; // add to existing lucide import
import SuggestedPlanCard from "./SuggestedPlanCard";
import VoiceFillButton from "./VoiceFillButton";
import VoiceReviewDialog from "./VoiceReviewDialog";
import BillDialog from "./BillDialog";
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
import {
    AIOverviewCard,
    SummaryCard,
    CardActionContext,
} from "./sections/shared";
import { downloadConsultationPdf } from "../utils/downloadConsultationPdf";
import BrandMark from "./BrandMark";
import PrescriptionEditor from "./PrescriptionEditor";
import HistorySectionEditor from "./HistorySectionEditor";
const DEFAULT_VITALS = [
    {
        name: "Systolic Blood Pressure",
        value: "",
        units: "mmHg",
        loinc_code: "8480-6",
    },
    {
        name: "Diastolic Blood Pressure",
        value: "",
        units: "mmHg",
        loinc_code: "8462-4",
    },
    { name: "Body Temperature", value: "", units: "°F", loinc_code: "8310-5" },
    { name: "Respiration", value: "", units: "per min", loinc_code: "9279-1" },
    { name: "Body Weight", value: "", units: "kgs", loinc_code: "29463-7" },
    { name: "Body Height", value: "", units: "ft", loinc_code: "8302-2" },
];
// Treats null/undefined, empty arrays, empty objects, and blank strings as "no data".
function isEmptyValue(v) {
    if (v === null || v === undefined) return true;
    if (Array.isArray(v)) return v.length === 0;
    if (typeof v === "object") return Object.keys(v).length === 0;
    if (typeof v === "string") return v.trim() === "";
    return false;
}
const cleanDoc = (d) => {
    if (!d || !d.raw_response) return d || {};
    const { raw_response, ...rest } = d; // eslint-disable-line no-unused-vars
    return rest;
};
export default function ResultView({ result, onReset }) {
    // `doc` holds the full structured_data, kept in sync as sections are edited
    // and saved, so the page (and the PDF) always reflects the latest state.
    const [doc, setDoc] = useState(() => cleanDoc(result?.structured_data));
    const hadFailure = !!result?.structured_data?.raw_response;
    const [billOpen, setBillOpen] = useState(false);
    const [voiceResult, setVoiceResult] = useState(null);
    const [editingSection, setEditingSection] = useState(null); // null | "prescription" | a section key
    useEffect(() => {
        setDoc(cleanDoc(result?.structured_data));
        setEditingSection(null);
        setBillOpen(false);
        setVoiceResult(null);
    }, [result]);

    const [showTranscript, setShowTranscript] = useState(false);
    const data = doc;
    const rx = data.prescription || null;
    const consultationId = result?.saved?.consultation_id;
    const canEdit = !!consultationId; // Applied after any section/prescription save — merges the edited section
    // and the freshly regenerated consultation_summary into local state.
    const saveSection = (key) => (body) => {
        setDoc((d) => ({
            ...d,
            [key]: body[key],
            consultation_summary:
                body.consultation_summary ?? d.consultation_summary,
        }));
        setEditingSection(null);
    };
    const applyVoiceBody = (body) => {
        setDoc((d) => ({
            ...d,
            ...(body.patch || {}),
            consultation_summary:
                body.consultation_summary ?? d.consultation_summary,
        }));
        setEditingSection(null);
    };
    const applySuggestion = (body) =>
        setDoc((d) => ({
            ...d,
            ...(body.prescription ? { prescription: body.prescription } : {}),
            suggested_plan: body.suggested_plan ?? d.suggested_plan,
            consultation_summary:
                body.consultation_summary ?? d.consultation_summary,
        }));

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
            key: "vitals",
            label: "Vitals",
            value: recordedVitals,
            render: () => <VitalsCard vitals={recordedVitals} />,
        },
        {
            key: "allergies",
            label: "Allergies",
            value: data.allergies,
            render: () => <AllergiesCard allergies={data.allergies} />,
        },
        {
            key: "conditions",
            label: "Conditions",
            value: data.conditions,
            render: () => <ConditionsCard conditions={data.conditions} />,
        },
        {
            key: "medication_history",
            label: "Medications",
            value: data.medication_history,
            render: () => (
                <MedicationsCard medications={data.medication_history} />
            ),
        },
        {
            key: "investigation_history",
            label: "Investigations",
            value: data.investigation_history,
            render: () => (
                <InvestigationsCard
                    investigations={data.investigation_history}
                />
            ),
        },
        {
            key: "procedures",
            label: "Procedures",
            value: data.procedures,
            render: () => <ProceduresCard procedures={data.procedures} />,
        },
        {
            key: "system_review",
            label: "System review",
            value: data.system_review,
            render: () => (
                <SystemReviewCard systemReview={data.system_review} />
            ),
        },
        {
            key: "family_history",
            label: "Family history",
            value: data.family_history,
            render: () => (
                <FamilyHistoryCard familyHistory={data.family_history} />
            ),
        },
        {
            key: "lifestyle_habits",
            label: "Lifestyle",
            value: data.lifestyle_habits,
            render: () => <LifestyleCard lifestyle={data.lifestyle_habits} />,
        },
        {
            key: "social_history",
            label: "Social history",
            value: data.social_history,
            render: () => (
                <SocialHistoryCard socialHistory={data.social_history} />
            ),
        },
        {
            key: "other_history",
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
                onDownload={() =>
                    downloadConsultationPdf({ ...result, structured_data: doc })
                }
                onBill={canEdit ? () => setBillOpen(true) : undefined}
            />
            {canEdit && (
                <div className="mb-5">
                    <VoiceFillButton
                        section="all"
                        onResult={setVoiceResult}
                        disabled={!!editingSection}
                    />
                    {editingSection && (
                        <p className="mt-2 text-xs text-muted">
                            Finish or cancel the open editor to use voice.
                        </p>
                    )}
                </div>
            )}
            {hadFailure && (
                <div className="mb-5 rounded-md border border-line bg-surface px-5 py-4 text-sm text-muted shadow-panel">
                    A summary could not be built for this consultation. You can
                    fill the sections by hand, or record the consultation again.
                    The transcript is at the bottom of the page.
                </div>
            )}
            {(data.consultation_summary?.overview ||
                data.consultation_summary?.details?.length > 0) && (
                <div className="mb-5">
                    <AIOverviewCard
                        overview={data.consultation_summary?.overview}
                        details={data.consultation_summary?.details}
                    />
                </div>
            )}
            <SuggestedPlanCard
                consultationId={consultationId}
                plan={data.suggested_plan}
                allergies={data.allergies}
                rx={rx}
                canEdit={canEdit}
                hasTranscript={!!result?.transcript}
                onChange={applySuggestion}
            />
            {/* {!isEmptyValue(data.consultation_summary) && (
                <div className="mb-5">
                    <AIOverviewCard
                        overview={data.consultation_summary.overview}
                        details={data.consultation_summary.details}
                    />
                </div>
            )} */}
            {/* <div className="columns-1 lg:columns-2 gap-5"> */}
            {editingSection === "prescription" ? (
                <div className="mb-5">
                    <PrescriptionEditor
                        consultationId={consultationId}
                        prescription={rx}
                        onSaved={saveSection("prescription")}
                        onCancel={() => setEditingSection(null)}
                    />
                </div>
            ) : (
                (rx || canEdit) && (
                    <div className="mb-5">
                        {canEdit && !rx && (
                            <button
                                type="button"
                                onClick={() =>
                                    setEditingSection("prescription")
                                }
                                className="inline-flex items-center gap-1.5 rounded border border-line bg-surface px-3 py-1.5 text-xs text-ink hover:bg-paper transition-colors"
                            >
                                <Pencil size={12} strokeWidth={1.75} />
                                Add prescription & plan
                            </button>
                        )}
                        {rx && (
                            <CardActionContext.Provider
                                value={
                                    canEdit
                                        ? {
                                              onEdit: () =>
                                                  setEditingSection(
                                                      "prescription",
                                                  ),
                                              label: "prescription and plan",
                                          }
                                        : null
                                }
                            >
                                <PrescriptionCard prescription={rx} />
                            </CardActionContext.Provider>
                        )}
                    </div>
                )
            )}
            <div className="columns-1 gap-5">
                {filledSections.map((s) => (
                    <div key={s.key} className="break-inside-avoid mb-5">
                        {editingSection === s.key ? (
                            <HistorySectionEditor
                                sectionKey={s.key}
                                consultationId={consultationId}
                                data={
                                    s.key === "vitals"
                                        ? data.vitals
                                        : data[s.key]
                                }
                                onSaved={saveSection(s.key)}
                                onCancel={() => setEditingSection(null)}
                            />
                        ) : (
                            <CardActionContext.Provider
                                value={
                                    canEdit
                                        ? {
                                              onEdit: () =>
                                                  setEditingSection(s.key),
                                              label: s.label,
                                          }
                                        : null
                                }
                            >
                                {s.render()}
                            </CardActionContext.Provider>
                        )}
                    </div>
                ))}
            </div>
            {editingSection &&
                emptySections.some((s) => s.key === editingSection) && (
                    <div className="mt-5">
                        <HistorySectionEditor
                            sectionKey={editingSection}
                            consultationId={consultationId}
                            data={
                                editingSection === "vitals"
                                    ? data.vitals?.length
                                        ? data.vitals
                                        : DEFAULT_VITALS
                                    : data[editingSection] || []
                            }
                            onSaved={saveSection(editingSection)}
                            onCancel={() => setEditingSection(null)}
                        />
                    </div>
                )}
            {emptySections.length > 0 && (
                <div className="mt-5 bg-surface border border-line rounded-md px-5 py-4">
                    <p className="font-serif text-base text-ink leading-tight mb-4">
                        Not recorded
                    </p>
                    <div className="flex flex-wrap gap-2">
                        {emptySections.map((s) =>
                            canEdit ? (
                                <button
                                    key={s.key}
                                    type="button"
                                    onClick={() => setEditingSection(s.key)}
                                    className="inline-flex items-center rounded-full border border-line bg-paper px-2.5 py-1 text-sm hover:bg-clinical-50 hover:text-ink transition-colors"
                                >
                                    + {s.label}
                                </button>
                            ) : (
                                <span
                                    key={s.key}
                                    className="inline-flex items-center rounded-full border border-line bg-paper px-2.5 py-1 text-sm"
                                >
                                    {s.label}
                                </span>
                            ),
                        )}
                    </div>
                </div>
            )}
            {/* {editingSection === "prescription" ? (
                <div className="mt-5">
                    <PrescriptionEditor
                        consultationId={consultationId}
                        prescription={rx}
                        onSaved={saveSection("prescription")}
                        onCancel={() => setEditingSection(null)}
                    />
                </div>
            ) : (
                <div className="mt-5">
                    {canEdit && !rx && (
                        <button
                            type="button"
                            onClick={() => setEditingSection("prescription")}
                            className="inline-flex items-center gap-1.5 rounded border border-line bg-surface px-3 py-1.5 text-xs text-ink hover:bg-paper transition-colors"
                        >
                            <Pencil size={12} strokeWidth={1.75} />
                            Add prescription & plan
                        </button>
                    )}
                    {rx && (
                        <CardActionContext.Provider
                            value={
                                canEdit
                                    ? {
                                          onEdit: () =>
                                              setEditingSection("prescription"),
                                          label: "prescription and plan",
                                      }
                                    : null
                            }
                        >
                            <PrescriptionCard prescription={rx} />
                        </CardActionContext.Provider>
                    )}
                </div>
            )} */}
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
            {billOpen && (
                <BillDialog
                    consultationId={consultationId}
                    onClose={() => setBillOpen(false)}
                />
            )}
            {voiceResult && (
                <VoiceReviewDialog
                    consultationId={consultationId}
                    result={voiceResult}
                    doc={doc}
                    editorOpen={!!editingSection}
                    onApplied={applyVoiceBody}
                    onClose={() => setVoiceResult(null)}
                />
            )}
        </div>
    );
}

function TopBar({ onReset, language, onDownload, onBill }) {
    return (
        <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
                {/* <div className="flex h-9 w-9 items-center justify-center rounded bg-clinical-500 text-paper">
                    <Stethoscope size={18} strokeWidth={1.75} />
                </div> */}
                {/* <BrandMark /> */}
                <button
                    type="button"
                    onClick={onReset}
                    className="inline-flex items-center gap-2 rounded border border-line bg-surface px-2.5 py-2.5 text-sm text-ink hover:bg-paper transition-colors"
                >
                    <ArrowLeft size={16} strokeWidth={1.75} />
                    {/* <span className="hidden sm:inline">Go Back</span> */}
                </button>

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
                        <span className="hidden sm:inline">Summary</span>
                    </button>
                )}
                {onBill && (
                    <button
                        type="button"
                        onClick={onBill}
                        className="inline-flex items-center gap-2 rounded border border-clinical-500 bg-clinical-50 px-2.5 py-2.5 text-sm text-clinical-600 hover:bg-clinical-500 hover:text-paper transition-colors"
                    >
                        <Receipt size={16} strokeWidth={1.75} />
                        <span className="hidden sm:inline">Create Bill</span>
                    </button>
                )}
            </div>
        </div>
    );
}
