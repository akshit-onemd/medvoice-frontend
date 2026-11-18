import React, { useEffect, useRef, useState, useMemo } from "react";
import {
    ArrowLeft,
    ChevronDown,
    Download,
    IndianRupee,
    Loader2,
    Pencil,
} from "lucide-react";
import { VitalsCard, AllergiesCard } from "./sections/VitalsAndAllergies";
import { Receipt } from "lucide-react"; // add to existing lucide import
import SuggestedPlanCard from "./SuggestedPlanCard";
import ShareWhatsAppButton from "./ShareWhatsAppButton";
import VoiceFillButton from "./VoiceFillButton";
import VoiceReviewDialog from "./VoiceReviewDialog";
import BillDialog from "./BillDialog";
import CodeReviewPanel from "./CodeReviewPanel";
import CodePickerDialog from "./CodePickerDialog";
import { collectCodeItems, vocabOfSystem } from "../utils/codeItems";

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
    CodeReviewContext,
    ShowCodesContext,
} from "./sections/shared";
import { useShowCodes } from "../utils/codePrefs";
import { layoutFor, useNoteTemplate } from "../utils/templateLayout";
import { SECTION_TYPES } from "../templates/sectionTypes";
import { isEmptyGeneral } from "../templates/general";
import GeneralSectionCard from "./sections/GeneralSectionCard";
import GeneralSectionEditor from "./GeneralSectionEditor";
import ChangeTemplateDialog from "./ChangeTemplateDialog";
import {
    applyBackground,
    codesPending,
    planPending,
    PENDING_STALE_MS,
} from "../utils/backgroundFill";
import { downloadConsultationPdf } from "../utils/downloadConsultationPdf";
import { noteHasContent, EMPTY_NOTE_MESSAGE } from "../utils/noteContent";
import BrandMark from "./BrandMark";
import PrescriptionEditor from "./PrescriptionEditor";
import HistorySectionEditor from "./HistorySectionEditor";
import {
    refreshSummary,
    saveCodes,
    getConsultation,
} from "../api/processAudio";
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
// Codes are looked up after a save. This copies only the code fields from a fresh copy of the
// record, so nothing the doctor is typing or has just changed gets replaced.
const CODEISH = /code|_verified|_corrected|umls_term|_status|_alts|_pending/;
const CODED_LISTS = [
    ["prescription", "symptoms"],
    ["prescription", "diagnosis"],
    ["allergies"],
    ["conditions"],
    ["procedures"],
    ["lifestyle_habits"],
    ["social_history"],
];
const pathGet = (o, p) => p.reduce((x, k) => x?.[k], o);
const pathSet = (o, p, v) =>
    p.length === 1
        ? { ...o, [p[0]]: v }
        : { ...o, [p[0]]: pathSet(o?.[p[0]] || {}, p.slice(1), v) };
function mergeCodes(cur, fresh) {
    let next = cur;
    for (const p of CODED_LISTS) {
        const a = pathGet(cur, p);
        const b = pathGet(fresh, p);
        if (!Array.isArray(a) || !Array.isArray(b)) continue;
        const nm = (e) =>
            String(e?.name || "")
                .trim()
                .toLowerCase();
        const merged = a.map((e) => {
            const m = b.find((x) => nm(x) && nm(x) === nm(e));
            if (!m) return e;
            const o = { ...e };
            for (const k of Object.keys(m)) if (CODEISH.test(k)) o[k] = m[k];
            for (const k of Object.keys(o))
                if (CODEISH.test(k) && !(k in m)) delete o[k];
            return o;
        });
        next = pathSet(next, p, merged);
    }
    return next;
}
const hasPendingCodes = (doc) =>
    CODED_LISTS.some((p) =>
        (pathGet(doc, p) || []).some((e) =>
            Object.keys(e || {}).some((k) => k.endsWith("_pending") && e[k]),
        ),
    );

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
    const [changeOpen, setChangeOpen] = useState(false);
    const [voiceResult, setVoiceResult] = useState(null);
    const [editingSection, setEditingSection] = useState(null); // null | "prescription" | a section key
    useEffect(() => {
        setDoc(cleanDoc(result?.structured_data));
        setEditingSection(null);
        setBillOpen(false);
        setVoiceResult(null);
    }, [result]);
    const [picker, setPicker] = useState(null);
    const codeItems = useMemo(() => collectCodeItems(doc), [doc]);
    const codeIndex = useMemo(() => {
        const m = new Map();
        codeItems.forEach(
            (i) =>
                i.code &&
                !m.has(`${i.vocab}|${i.code}`) &&
                m.set(`${i.vocab}|${i.code}`, i),
        );
        return m;
    }, [codeItems]);
    const consultationId = result?.saved?.consultation_id;
    const canEdit = !!consultationId; // Applied after any section/prescription save — merges the edited section

    const codeCtx = useMemo(
        () => ({
            lookup: (system, code) =>
                codeIndex.get(`${vocabOfSystem(system)}|${code}`) || null,
            open: canEdit ? setPicker : null,
        }),
        [codeIndex, canEdit],
    );
    const [showTranscript, setShowTranscript] = useState(false);
    const showCodes = useShowCodes();

    // Right after an upload the codes and the AI plan are still being prepared on the server.
    // Check every few seconds and bring them in when they arrive.
    const waitingCodes = codesPending(doc);
    const waitingPlan = planPending(doc);
    useEffect(() => {
        if (!consultationId || (!waitingCodes && !waitingPlan)) return;
        const until = Date.now() + PENDING_STALE_MS;
        let busy = false;
        const timer = setInterval(async () => {
            if (Date.now() > until) {
                clearInterval(timer);
                setDoc((d) => ({ ...d })); // shows the page without the waiting state
                return;
            }
            if (busy) return;
            busy = true;
            try {
                const c = await getConsultation(consultationId);
                const fresh = cleanDoc(c?.structured_data);
                setDoc((d) => applyBackground(d, fresh));
            } catch {
                /* try again on the next tick */
            } finally {
                busy = false;
            }
        }, 3000);
        return () => clearInterval(timer);
    }, [consultationId, waitingCodes, waitingPlan]);

    const data = doc;
    // The note's template decides which sections show, in what order, with what titles
    const noteTemplate = useNoteTemplate(doc);
    const layout = useMemo(() => layoutFor(noteTemplate), [noteTemplate]);
    const planKinds = [
        layout.has("prescription") && "medication",
        layout.has("diagnosis") && "diagnosis",
        layout.has("followup") && "followup",
    ].filter(Boolean);
    const rx = data.prescription || null;
    // and the freshly regenerated consultation_summary into local state.
    // Saving is quick now. The overview and any new codes arrive a little later.
    const saveSection = (key) => (body) => {
        setDoc((d) => ({
            ...d,
            [key]: body[key],
            consultation_summary:
                body.consultation_summary ?? d.consultation_summary,
        }));
        setEditingSection(null);
        refreshOverview();
        if (body.codes_pending) watchCodes();
    };
    const applyVoiceBody = (body) => {
        setDoc((d) => ({ ...d, ...(body.patch || {}) }));
        setEditingSection(null);
        refreshOverview();
        if (body.codes_pending) watchCodes();
    };
    const applySuggestion = (body) => {
        setDoc((d) => ({
            ...d,
            ...(body.prescription ? { prescription: body.prescription } : {}),
            suggested_plan: body.suggested_plan ?? d.suggested_plan,
            consultation_summary:
                body.consultation_summary ?? d.consultation_summary,
        }));
        if (body.prescription) {
            refreshOverview(); // medicines were added
            if (body.codes_pending) watchCodes();
        }
    };

    // Looks again a few times until the new codes have been written
    const codeTimers = useRef([]);
    useEffect(
        () => () => codeTimers.current.forEach((t) => clearTimeout(t)),
        [],
    );
    const watchCodes = () => {
        codeTimers.current.forEach((t) => clearTimeout(t));
        codeTimers.current = [5000, 12000, 25000, 45000].map((ms) =>
            setTimeout(async () => {
                try {
                    const fresh = await getConsultation(consultationId);
                    const next = cleanDoc(fresh?.structured_data);
                    setDoc((d) => mergeCodes(d, next));
                    if (!hasPendingCodes(next))
                        codeTimers.current.forEach((t) => clearTimeout(t));
                } catch {
                    /* the codes will show on the next visit */
                }
            }, ms),
        );
    };
    const [summaryBusy, setSummaryBusy] = useState(false);
    const refreshTicket = useRef(0);

    const refreshOverview = () => {
        const ticket = ++refreshTicket.current;
        setSummaryBusy(true);
        refreshSummary(consultationId)
            .then((b) => {
                if (ticket !== refreshTicket.current) return; // a newer refresh is running
                setDoc((d) => ({
                    ...d,
                    consultation_summary:
                        b.consultation_summary ?? d.consultation_summary,
                }));
            })
            .catch(() => {})
            .finally(() => {
                if (ticket === refreshTicket.current) setSummaryBusy(false);
            });
    };
    // vitals is always a fixed-length array of { name, units, value, loinc_code };
    // unrecorded vitals come back with value: "", so filter those out before
    // deciding whether the section has anything to show.
    const recordedVitals = (data.vitals || []).filter(
        (v) =>
            v?.value !== undefined &&
            v?.value !== null &&
            String(v.value).trim() !== "",
    );

    const allSections = [
        {
            key: "vitals",
            label: "Vitals",
            value: recordedVitals,
            render: (title) => <VitalsCard title={title} vitals={recordedVitals} />,
        },
        {
            key: "allergies",
            label: "Allergies",
            value: data.allergies,
            render: (title) => <AllergiesCard title={title} allergies={data.allergies} />,
        },
        {
            key: "conditions",
            label: "Conditions",
            value: data.conditions,
            render: (title) => <ConditionsCard title={title} conditions={data.conditions} />,
        },
        {
            key: "medication_history",
            label: "Medications",
            value: data.medication_history,
            render: (title) => (
                <MedicationsCard title={title} medications={data.medication_history} />
            ),
        },
        {
            key: "investigation_history",
            label: "Investigations",
            value: data.investigation_history,
            render: (title) => (
                <InvestigationsCard title={title}
                    investigations={data.investigation_history}
                />
            ),
        },
        {
            key: "procedures",
            label: "Procedures",
            value: data.procedures,
            render: (title) => <ProceduresCard title={title} procedures={data.procedures} />,
        },
        {
            key: "system_review",
            label: "System review",
            value: data.system_review,
            render: (title) => (
                <SystemReviewCard title={title} systemReview={data.system_review} />
            ),
        },
        {
            key: "family_history",
            label: "Family history",
            value: data.family_history,
            render: (title) => (
                <FamilyHistoryCard title={title} familyHistory={data.family_history} />
            ),
        },
        {
            key: "lifestyle_habits",
            label: "Lifestyle",
            value: data.lifestyle_habits,
            render: (title) => <LifestyleCard title={title} lifestyle={data.lifestyle_habits} />,
        },
        {
            key: "social_history",
            label: "Social history",
            value: data.social_history,
            render: (title) => (
                <SocialHistoryCard title={title} socialHistory={data.social_history} />
            ),
        },
        {
            key: "other_history",
            label: "Other history",
            value: data.other_history,
            render: (title) => (
                <OtherHistoryCard title={title} otherHistory={data.other_history} />
            ),
        },
    ];

    // Only the template's history sections, in its order, with its titles
    const byKey = Object.fromEntries(allSections.map((s) => [s.key, s]));
    const sections = layout.cards
        .filter((c) => c.general || byKey[c.key])
        .map((c) =>
            c.general
                ? {
                      key: c.key,
                      label: c.title,
                      general: c.section,
                      value: data.custom?.[c.section.id],
                      empty: isEmptyGeneral(c.section, data.custom?.[c.section.id]),
                      render: () => (
                          <GeneralSectionCard
                              section={c.section}
                              value={data.custom?.[c.section.id]}
                              title={c.title}
                          />
                      ),
                  }
                : {
            ...byKey[c.key],
            // Keep the short chip name unless the template renamed the section
            label:
                c.title !== SECTION_TYPES[c.type]?.title
                    ? c.title
                    : byKey[c.key].label,
            render: () => byKey[c.key].render(c.title),
        });
    const isEmptySection = (s) => (s.general ? s.empty : isEmptyValue(s.value));
    const filledSections = sections.filter((s) => !isEmptySection(s));
    const emptySections = sections.filter(isEmptySection);
    const editingGeneral = sections.find((s) => s.general && s.key === editingSection);
    const saveCustom = (custom) => {
        setDoc((d) => ({ ...d, custom }));
        setEditingSection(null);
        refreshOverview();
    };
    const generalEditor = (s) => (
        <GeneralSectionEditor
            section={s.general}
            value={s.value}
            title={s.label}
            consultationId={consultationId}
            onSaved={saveCustom}
            onCancel={() => setEditingSection(null)}
        />
    );
    // Rebuilding needs the recording; visits from uploaded reports only can't change template
    const canChangeTemplate = canEdit && (result?.transcript || "").trim().length >= 40;
    // An empty note can't be printed or billed
    const hasContent = noteHasContent(doc);

    return (
        <CodeReviewContext.Provider value={codeCtx}>
            <ShowCodesContext.Provider value={showCodes}>
                <div className="w-full max-w-3xl mx-auto">
                    <TopBar
                        onReset={onReset}
                        language={result?.language}
                        onDownload={() =>
                            downloadConsultationPdf({
                                ...result,
                                structured_data: doc,
                            })
                        }
                        onBill={canEdit ? () => setBillOpen(true) : undefined}
                        empty={!hasContent}
                        share={
                            <ShareWhatsAppButton
                                patientName={result?.saved?.patient_name}
                                phone={result?.saved?.patient_phone}
                                disabled={!hasContent}
                            />
                        }
                    />
                    {(doc.template?.name || canChangeTemplate) && (
                        <div className="-mt-3 mb-5 flex items-center gap-2 pl-[52px] text-sm text-muted">
                            <span>
                                Template:
                                <span className="text-ink">
                                    {doc.template?.name || noteTemplate?.name || "General OPD"}
                                </span>
                            </span>
                            {canChangeTemplate && (
                                <button
                                    type="button"
                                    onClick={() => setChangeOpen(true)}
                                    disabled={!!editingSection}
                                    className="text-clinical-600 hover:underline disabled:opacity-40"
                                >
                                    Change
                                </button>
                            )}
                        </div>
                    )}
                    {canEdit && (
                        <div className="mb-5">
                            <VoiceFillButton
                                section="all"
                                consultationId={consultationId}
                                onResult={setVoiceResult}
                                disabled={!!editingSection}
                            />
                            {editingSection && (
                                <p className="mt-2 text-xs text-muted">
                                    Finish or cancel the open editor to use
                                    voice.
                                </p>
                            )}
                        </div>
                    )}
                    {hadFailure && (
                        <div className="mb-5 rounded-md border border-line bg-surface px-5 py-4 text-sm text-muted shadow-panel">
                            A summary could not be built for this consultation.
                            You can fill the sections by hand, or record the
                            consultation again. The transcript is at the bottom
                            of the page.
                        </div>
                    )}
                    {(data.consultation_summary?.overview ||
                        data.consultation_summary?.details?.length > 0) && (
                        <div className="mb-5">
                            <AIOverviewCard
                                overview={data.consultation_summary?.overview}
                                details={data.consultation_summary?.details}
                                updating={summaryBusy}
                            />
                        </div>
                    )}
                    <SuggestedPlanCard
                        allowedKinds={planKinds}
                        consultationId={consultationId}
                        plan={data.suggested_plan}
                        allergies={data.allergies}
                        rx={rx}
                        canEdit={canEdit}
                        hasTranscript={
                            !!result?.transcript ||
                            [
                                data.investigation_history,
                                data.system_review,
                                data.conditions,
                                data.medication_history,
                                data.prescription?.symptoms,
                            ].some((l) => Array.isArray(l) && l.length > 0)
                        }
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
                                parts={layout.rx}
                                onSaved={saveSection("prescription")}
                                onCancel={() => setEditingSection(null)}
                            />
                        </div>
                    ) : (
                        (rx || canEdit) && (
                            <div className="mb-5">
                                {canEdit && !rx && layout.rx.length > 0 && (
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
                                {rx && layout.rx.length > 0 && (
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
                                        <PrescriptionCard prescription={rx} parts={layout.rx} />
                                    </CardActionContext.Provider>
                                )}
                            </div>
                        )
                    )}
                    {showCodes && waitingCodes && (
                        <div
                            role="status"
                            className="mb-5 flex items-center gap-2 rounded-md border border-line bg-surface px-5 py-3 text-sm text-muted shadow-panel"
                        >
                            <Loader2
                                size={14}
                                className="shrink-0 animate-spin text-clinical-600"
                            />
                            Adding medical codes…
                        </div>
                    )}
                    {showCodes && (
                        <CodeReviewPanel
                            items={codeItems}
                            canEdit={canEdit}
                            consultationId={consultationId}
                            onChanged={setDoc}
                            onPick={setPicker}
                        />
                    )}
                    <div className="columns-1 gap-5">
                        {filledSections.map((s) => (
                            <div
                                key={s.key}
                                className="break-inside-avoid mb-5"
                            >
                                {editingSection === s.key && s.general ? (
                                    generalEditor(s)
                                ) : editingSection === s.key ? (
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
                                                          setEditingSection(
                                                              s.key,
                                                          ),
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
                    {editingGeneral && isEmptySection(editingGeneral) && (
                        <div className="mt-5">{generalEditor(editingGeneral)}</div>
                    )}
                    {editingSection &&
                        !editingGeneral &&
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
                            <p className="font-display text-base text-ink leading-tight mb-4">
                                Not recorded
                            </p>
                            <div className="flex flex-wrap gap-2">
                                {emptySections.map((s) =>
                                    canEdit ? (
                                        <button
                                            key={s.key}
                                            type="button"
                                            onClick={() =>
                                                setEditingSection(s.key)
                                            }
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
                    {canEdit && !rx && layout.rx.length > 0 && (
                        <button
                            type="button"
                            onClick={() => setEditingSection("prescription")}
                            className="inline-flex items-center gap-1.5 rounded border border-line bg-surface px-3 py-1.5 text-xs text-ink hover:bg-paper transition-colors"
                        >
                            <Pencil size={12} strokeWidth={1.75} />
                            Add prescription & plan
                        </button>
                    )}
                    {rx && layout.rx.length > 0 && (
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
                            <PrescriptionCard prescription={rx} parts={layout.rx} />
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
                                <span className="font-display text-base text-ink">
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
                                                    line.match(
                                                        /^([^:]+):\s*(.*)$/,
                                                    );
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
                    {changeOpen && (
                        <ChangeTemplateDialog
                            consultationId={consultationId}
                            currentId={doc.template?.id}
                            onChanged={(sd) => {
                                setDoc(cleanDoc(sd));
                                setEditingSection(null);
                            }}
                            onClose={() => setChangeOpen(false)}
                        />
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
                            template={noteTemplate}
                            editorOpen={!!editingSection}
                            onApplied={applyVoiceBody}
                            onClose={() => setVoiceResult(null)}
                        />
                    )}
                    {showCodes && picker && (
                        <CodePickerDialog
                            item={picker}
                            onClose={() => setPicker(null)}
                            onPick={async (code) => {
                                const body = await saveCodes(consultationId, [
                                    { path: picker.path, code },
                                ]);
                                setDoc(body.structured_data);
                            }}
                        />
                    )}
                </div>
            </ShowCodesContext.Provider>
        </CodeReviewContext.Provider>
    );
}

function TopBar({ onReset, language, onDownload, onBill, share = null, empty = false }) {
    return (
        <div className="flex items-center justify-between gap-3 mb-6">
            <div className="flex items-center gap-3">
                {/* <div className="flex h-9 w-9 items-center justify-center rounded bg-clinical-500 text-paper">
                    <Stethoscope size={18} strokeWidth={1.75} />
                </div> */}
                {/* <BrandMark /> */}
                <button
                    type="button"
                    onClick={onReset}
                    aria-label="Back"
                    className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-line bg-surface text-ink hover:bg-paper transition-colors"
                >
                    <ArrowLeft size={16} strokeWidth={1.75} />
                    {/* <span className="hidden sm:inline">Go Back</span> */}
                </button>

                <div>
                    <h1 className="font-display text-xl sm:text-[28px] leading-tight text-ink">
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
                        disabled={empty}
                        title={empty ? EMPTY_NOTE_MESSAGE : undefined}
                        className="inline-flex h-10 items-center gap-2 rounded-lg bg-clinical-500 px-3.5 text-sm font-medium text-white hover:bg-clinical-600 transition-colors disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-clinical-500"
                    >
                        <Download size={16} strokeWidth={1.75} />
                        <span className="hidden sm:inline">Download PDF</span>
                    </button>
                )}
                {onBill && (
                    <button
                        type="button"
                        onClick={onBill}
                        disabled={empty}
                        title={empty ? "Add details to the note before creating a bill." : undefined}
                        className="inline-flex h-10 items-center gap-2 rounded-lg border border-line bg-surface px-3.5 text-sm font-medium text-ink hover:bg-paper transition-colors disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-surface"
                    >
                        <IndianRupee size={16} strokeWidth={1.75} />
                        <span className="hidden sm:inline">Create Bill</span>
                    </button>
                )}
                {share}
            </div>
        </div>
    );
}
