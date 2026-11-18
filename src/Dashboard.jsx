import React, { useState, useEffect, useRef } from "react";
import { Mic, Users, Settings, LayoutTemplate } from "lucide-react";
import AppShell from "./components/AppShell";
import TemplatesPage from "./components/templates/TemplatesPage";
import PatientList from "./components/PatientList";
import UploadPanel from "./components/UploadPanel";
import ProcessingView from "./components/ProcessingView";
import ResultView from "./components/ResultView";
import ErrorView from "./components/ErrorView";
import PatientRecords from "./components/PatientRecords";
import ProfileForm from "./components/ProfileForm";
import { processAudio, listPatients } from "./api/processAudio";
import { prefetchTemplates } from "./api/templateCache";
import { setCached } from "./utils/cache";
import LetterheadSettings from "./components/LetterheadSettings";
import RateCardSettings from "./components/RateCardSettings";
import BillLetterheadSettings from "./components/BillLetterheadSettings";
import useBackNav from "./hooks/useBackNav";
import { clearAllDrafts, clearHomeDrafts } from "./utils/draftStore";
import { useAnyDirty, isAnyDirty } from "./hooks/useDirty";
import BrandSettings from "./components/BrandSettings";
import CodeSettings from "./components/CodeSettings";
const SETTINGS_TABS = [
    ["profile", "Profile"],
    ["letterheads", "Letterheads"],
    ["billing", "Billing"],
    ["prescribing", "Prescribing"],
];
// idle -> processing -> result | error
// records is a parallel top-level stage, reachable from idle/result/error via the nav
// profile is an overlay view controlled by showProfile, not a stage
export default function Dashboard({ profile, onProfileChange }) {
    // Fetch what the other tabs need while the doctor is on New visit, so they open at once
    useEffect(() => {
        prefetchTemplates();
        listPatients({ q: "", offset: 0, limit: 20 })
            .then((d) => setCached("patients:first:doctor", { patients: d.patients, hasMore: d.hasMore }))
            .catch(() => {});
    }, []);
    const [stage, setStage] = useState("idle");
    const [fileName, setFileName] = useState("");
    const [processingStage, setProcessingStage] = useState(0);
    const [result, setResult] = useState(null);
    const [errorInfo, setErrorInfo] = useState(null);
    const lastRun = useRef(null);
    const [showProfile, setShowProfile] = useState(false);
    const [detailPatient, setDetailPatient] = useState(null);
    const [uploadKey, setUploadKey] = useState(0);
    const [startPatient, setStartPatient] = useState(null);
    const [detailFrom, setDetailFrom] = useState("home");
    const [settingsTab, setSettingsTab] = useState("profile");
    const dirty = useAnyDirty();

    // Start every screen change at the top of the page
    useEffect(() => {
        window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    }, [stage, showProfile]);

    const runProcess = async (args, retry = null) => {
        lastRun.current = args;
        const { file, attachments, patientInfo, sttProvider, templateId } =
            args;
        setFileName(
            file
                ? file.name
                : `${attachments.length} document${attachments.length === 1 ? "" : "s"}`,
        );
        setErrorInfo(null);
        setStage("processing");
        setProcessingStage(0);
        try {
            const data = await processAudio(
                file,
                attachments,
                patientInfo,
                sttProvider,
                setProcessingStage,
                retry,
                templateId,
            );
            setResult(data);
            setStage("result");
            clearHomeDrafts(); // only now is the draft safe to delete
        } catch (err) {
            setErrorInfo({
                message:
                    err.message || "Something went wrong. Please try again.",
                transcript: err.transcript || null,
                diarizedTranscript: err.diarizedTranscript || null,
                language: err.language || null,
            });
            setStage("error");
        }
    };

    const handleSubmit = (
        file,
        attachments,
        patientInfo,
        sttProvider,
        templateId,
    ) =>
        runProcess({ file, attachments, patientInfo, sttProvider, templateId });

    const handleRetry = () => {
        const args = lastRun.current;
        if (!args) {
            reset();
            return;
        }
        // Transcription worked: send the transcript. Otherwise send the audio again.
        runProcess(
            args,
            errorInfo?.transcript
                ? {
                      transcript: errorInfo.transcript,
                      diarizedTranscript: errorInfo.diarizedTranscript,
                      language: errorInfo.language,
                  }
                : null,
        );
    };
    const reset = () => {
        setShowProfile(false);
        setStage("idle");
        setResult(null);
        setErrorInfo(null);
        setFileName("");
        setDetailPatient(null);
        setStartPatient(null);
        lastRun.current = null;
    };

    const confirmLeaveDraft = () => {
        if (!isAnyDirty()) return true;
        if (!window.confirm("You have unsaved changes. Discard them?"))
            return false;
        clearAllDrafts();
        return true;
    };
    const goHome = () => {
        if (!confirmLeaveDraft()) return;
        if (isAnyDirty() || startPatient) setUploadKey((k) => k + 1); // clears a draft
        reset();
    };

    const handleBack = () => {
        if (stage === "processing") return "stay";
        if (isAnyDirty()) {
            if (!window.confirm("You have unsaved changes. Discard them?"))
                return "stay";
            clearAllDrafts();
        }
        if (showProfile) {
            setShowProfile(false);
            return "stay";
        }
        if (stage === "patient") {
            if (detailFrom === "patients") setStage("patients");
            else reset();
            return "stay";
        }
        if (stage !== "idle") {
            reset();
            return "stay";
        }
        return "leave"; // Home: exit the app
    };

    useBackNav({
        active:
            dirty || stage === "processing" || showProfile || stage !== "idle",
        warnOnUnload: dirty || stage === "processing",
        onBack: handleBack,
    });

    const openPatient = (p, from = "home") => {
        setShowProfile(false);
        setResult(null);
        setErrorInfo(null);
        setFileName("");
        setDetailPatient(p);
        setDetailFrom(from);
        setStage("patient");
    };

    const startWith = (p) => {
        setShowProfile(false);
        setResult(null);
        setErrorInfo(null);
        setFileName("");
        setDetailPatient(null);
        setStartPatient(p);
        setUploadKey((k) => k + 1);
        setStage("idle");
    };

    const goPatients = () => {
        if (!confirmLeaveDraft()) return;
        setShowProfile(false);
        setResult(null);
        setErrorInfo(null);
        setFileName("");
        setStartPatient(null);
        setStage("patients");
    };
    const goTemplates = () => {
        if (!confirmLeaveDraft()) return;
        setShowProfile(false);
        setResult(null);
        setErrorInfo(null);
        setFileName("");
        setStartPatient(null);
        setStage("templates");
    }; // const goToRecords = () => {
    //     setShowProfile(false);
    //     setResult(null);
    // setErrorInfo(null);
    //     setFileName("");
    //     setStage("records");
    // };

    // Nav is hidden during active recording/processing/result review and while
    // the profile form is open — only shown on idle, records, and error.
    // const showNav =
    //     !showProfile &&
    //     (stage === "idle" || stage === "records" || stage === "error");

    const onHomeScreen = stage === "idle" && !showProfile;
    const nav = [
        {
            key: "home",
            label: "New visit",
            icon: Mic,
            active:
                !showProfile &&
                ["idle", "processing", "result", "error"].includes(stage),
            onClick: () => !onHomeScreen && goHome(),
        },
        {
            key: "patients",
            label: "Patients",
            icon: Users,
            active:
                !showProfile && (stage === "patients" || stage === "patient"),
            onClick: goPatients,
        },
        {
            key: "templates",
            label: "Templates",
            icon: LayoutTemplate,
            active: !showProfile && stage === "templates",
            onClick: goTemplates,
        },
        {
            key: "settings",
            label: "Settings",
            icon: Settings,
            active: showProfile,
            onClick: () =>
                !showProfile && confirmLeaveDraft() && setShowProfile(true),
        },
    ];
    const switchSettingsTab = (t) => {
        if (t === settingsTab || !confirmLeaveDraft()) return;
        setSettingsTab(t);
    };

    return (
        <AppShell
            nav={nav}
            onHome={() => !onHomeScreen && goHome()}
            disabled={stage === "processing"}
            accountName={profile?.name || ""}
            accountNote={profile?.clinic_name || ""}
        >
            {showProfile ? (
                <div className="mx-auto w-full max-w-3xl">
                    <h1 className="page-title">Settings</h1>
                    <div
                        role="tablist"
                        aria-label="Settings sections"
                        className="mb-6 mt-4 flex gap-1 overflow-x-auto rounded-lg border border-line bg-surface p-1"
                    >
                        {SETTINGS_TABS.map(([key, label]) => (
                            <button
                                key={key}
                                type="button"
                                role="tab"
                                aria-selected={settingsTab === key}
                                onClick={() => switchSettingsTab(key)}
                                className={`shrink-0 flex-1 whitespace-nowrap rounded px-3 py-2 text-sm transition-colors ${
                                    settingsTab === key
                                        ? "bg-ink font-medium text-white"
                                        : "text-muted hover:bg-paper hover:text-ink"
                                }`}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                    {settingsTab === "profile" && (
                        <ProfileForm
                            title="Doctor profile"
                            intro="Your name and signature appear on the consultation PDFs you download."
                            initial={profile}
                            onSaved={(p) => {
                                onProfileChange(p);
                                setShowProfile(false);
                            }}
                            onCancel={() => setShowProfile(false)}
                        />
                    )}
                    {settingsTab === "letterheads" && (
                        <div className="space-y-5">
                            <LetterheadSettings
                                profile={profile}
                                onChange={onProfileChange}
                            />
                            <BillLetterheadSettings
                                profile={profile}
                                onChange={onProfileChange}
                            />
                        </div>
                    )}
                    {settingsTab === "billing" && <RateCardSettings />}
                    {settingsTab === "prescribing" && (
                        <div className="rounded-md border border-line bg-surface p-6 shadow-panel [&>div:first-child]:mt-0">
                            <BrandSettings />
                            <CodeSettings />
                        </div>
                    )}
                </div>
            ) : (
                <>
                    {stage === "idle" && (
                        <UploadPanel
                            key={uploadKey}
                            initialPatient={startPatient}
                            onSubmit={handleSubmit}
                            onViewDetails={(p) =>
                                confirmLeaveDraft() && openPatient(p, "home")
                            }
                        />
                    )}
                    {stage === "templates" && <TemplatesPage />}
                    {stage === "patients" && (
                        <PatientList
                            onSelect={startWith}
                            onViewDetails={(p) => openPatient(p, "patients")}
                        />
                    )}
                    {stage === "patient" && detailPatient && (
                        <PatientRecords
                            patient={detailPatient}
                            onBack={() =>
                                detailFrom === "patients"
                                    ? setStage("patients")
                                    : reset()
                            }
                            onNewVisit={() => startWith(detailPatient)}
                        />
                    )}
                    {stage === "processing" && (
                        <ProcessingView
                            currentStage={processingStage}
                            fileName={fileName}
                        />
                    )}
                    {stage === "result" && (
                        <ResultView result={result} onReset={reset} />
                    )}
                    {stage === "error" && (
                        <ErrorView
                            info={errorInfo}
                            onRetry={handleRetry}
                            onBack={reset}
                        />
                    )}
                </>
            )}
        </AppShell>
    );
}
