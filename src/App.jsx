import React, { useState } from "react";
import { Mic, Plus, Users, Stethoscope } from "lucide-react";
import UploadPanel from "./components/UploadPanel";
import ProcessingView from "./components/ProcessingView";
import ResultView from "./components/ResultView";
import ErrorView from "./components/ErrorView";
import PatientRecords from "./components/PatientRecords";
import { processAudio } from "./api/processAudio";

// idle -> processing -> result | error
// records is a parallel top-level stage, reachable from idle/result/error via the nav
export default function App() {
    const [stage, setStage] = useState("idle");
    const [fileName, setFileName] = useState("");
    const [processingStage, setProcessingStage] = useState(0);
    const [result, setResult] = useState(null);
    const [errorMessage, setErrorMessage] = useState("");

    const handleSubmit = async (
        file,
        attachments,
        patientInfo,
        sttProvider,
    ) => {
        setFileName(
            file
                ? file.name
                : `${attachments.length} document${attachments.length === 1 ? "" : "s"}`,
        );
        setStage("processing");
        setProcessingStage(0);
        try {
            const data = await processAudio(
                file,
                attachments,
                patientInfo,
                sttProvider,
                setProcessingStage,
            );
            setResult(data);
            setStage("result");
        } catch (err) {
            setErrorMessage(err.message || "Something unexpected happened.");
            setStage("error");
        }
    };

    const reset = () => {
        setStage("idle");
        setResult(null);
        setErrorMessage("");
        setFileName("");
    };

    const goToRecords = () => {
        setResult(null);
        setErrorMessage("");
        setFileName("");
        setStage("records");
    };

    // Nav is hidden during active recording/processing/result review so it
    // doesn't distract mid-flow — only shown on idle, records, and error.
    const showNav =
        stage === "idle" || stage === "records" || stage === "error";

    return (
        <div className="min-h-screen bg-paper px-4 pt-24 pb-16">
            <div className="fixed top-0 left-0 right-0 z-50 bg-paper border-b border-line">
                <div className="w-full max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded bg-clinical-500 text-paper">
                        <Stethoscope size={20} strokeWidth={1.75} />
                    </div>
                    <div>
                        <h1 className="font-serif text-3xl text-ink leading-tight">
                            OneMD Scribe
                        </h1>
                    </div>
                </div>
            </div>

            <div className="w-full max-w-2xl mx-auto mb-6">
                {showNav && (
                    <div className="flex gap-6 border-b border-line">
                        <button
                            type="button"
                            onClick={reset}
                            className={`w-full justify-center inline-flex items-center gap-2 pb-3 text-sm border-b-2 transition-colors ${
                                stage === "idle" || stage === "error"
                                    ? "border-clinical-500 text-clinical-600 font-medium"
                                    : "border-transparent text-muted hover:text-ink"
                            }`}
                        >
                            <Plus size={14} strokeWidth={1.75} />
                            New consultation
                        </button>
                        <button
                            type="button"
                            onClick={goToRecords}
                            className={`w-full justify-center inline-flex items-center gap-2 pb-3 text-sm border-b-2 transition-colors ${
                                stage === "records"
                                    ? "border-clinical-500 text-clinical-600 font-medium"
                                    : "border-transparent text-muted hover:text-ink"
                            }`}
                        >
                            <Users size={14} strokeWidth={1.75} />
                            Patient records
                        </button>
                    </div>
                )}
            </div>
            {stage === "idle" && <UploadPanel onSubmit={handleSubmit} />}
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
                <ErrorView message={errorMessage} onRetry={reset} />
            )}
            {stage === "records" && <PatientRecords />}
        </div>
    );
}
