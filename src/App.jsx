import React, { useState } from "react";
import UploadPanel from "./components/UploadPanel";
import ProcessingView from "./components/ProcessingView";
import ResultView from "./components/ResultView";
import ErrorView from "./components/ErrorView";
import { processAudio } from "./api/processAudio";

// idle -> processing -> result | error
export default function App() {
    const [stage, setStage] = useState("idle");
    const [fileName, setFileName] = useState("");
    const [processingStage, setProcessingStage] = useState(0);
    const [result, setResult] = useState(null);
    const [errorMessage, setErrorMessage] = useState("");

    const handleSubmit = async (file, attachments, patientInfo) => {
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

    return (
        <div className="min-h-screen bg-paper px-4 py-10 sm:py-16">
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
        </div>
    );
}
