import React, { useCallback, useRef, useState, useEffect } from "react";
import LiveWaveform from "./LiveWaveform";
import AudioPlayer from "./AudioPlayer";
import { downsample, decodePeaks } from "../utils/audioPeaks";
import { useDirtyFlag } from "../hooks/useDirty";
import useHomeDraft from "../hooks/useHomeDraft";
import {
    beginRecordingDraft,
    appendRecordingChunk,
    removeItem,
} from "../utils/draftStore";
import {
    Mic,
    Square,
    Pause,
    UploadCloud,
    RotateCcw,
    FileAudio,
    X,
    Paperclip,
    FileText,
    Camera,
    SwitchCamera,
    Plus,
    UserPlus,
    Sparkles,
    ScanLine,
    Play,
} from "lucide-react";
import SearchInput from "./SearchInput";
import PatientForm from "./PatientForm";
import { searchPatients, createPatient } from "../api/processAudio";
import ScanPages from "./ScanPages";
function formatSize(bytes) {
    if (!bytes) return "";
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(0)} KB`;
    return `${(kb / 1024).toFixed(1)} MB`;
}

function formatDuration(seconds) {
    const m = Math.floor(seconds / 60)
        .toString()
        .padStart(2, "0");
    const s = Math.floor(seconds % 60)
        .toString()
        .padStart(2, "0");
    return `${m}:${s}`;
}

export default function UploadPanel({
    onSubmit,
    onViewDetails,
    initialPatient,
}) {
    const [file, setFile] = useState(null);
    const [isRecording, setIsRecording] = useState(false);
    const [recordSeconds, setRecordSeconds] = useState(0);
    const [error, setError] = useState("");
    const [attachments, setAttachments] = useState([]);
    const inputRef = useRef(null);
    const nativeCamRef = useRef(null);
    const mediaRecorderRef = useRef(null);
    const chunksRef = useRef([]);
    const timerRef = useRef(null);
    const [showCamera, setShowCamera] = useState(false);
    const [facingMode, setFacingMode] = useState("environment");
    const videoRef = useRef(null);
    const cameraStreamRef = useRef(null);
    const [previewPhoto, setPreviewPhoto] = useState(null); // { blob, url }
    const [patientQuery, setPatientQuery] = useState("");
    const [patientResults, setPatientResults] = useState([]);
    const [searchingPatient, setSearchingPatient] = useState(false);
    const [recStream, setRecStream] = useState(null);
    const [selectedPatient, setSelectedPatient] = useState(
        initialPatient || null,
    );
    const chunkIndexRef = useRef(0);
    const peaksRef = useRef([]);
    const startedAtRef = useRef(0);
    const peaksToken = useRef(0);
    const [filePeaks, setFilePeaks] = useState(null);
    const [fileDuration, setFileDuration] = useState(0);
    const [scanOpen, setScanOpen] = useState(false);
    const [newPatientSeed, setNewPatientSeed] = useState(null); // null | { name, phone }
    const [creatingPatient, setCreatingPatient] = useState(false);
    const [createError, setCreateError] = useState("");
    const [sttProvider, setSttProvider] = useState("elevenlabs");
    const [searchedFor, setSearchedFor] = useState("");
    const [fileLabel, setFileLabel] = useState("");
    const [isPaused, setIsPaused] = useState(false);
    const pausedRef = useRef(false);
    const activeMsRef = useRef(0);
    const segStartRef = useRef(0);
    const canPause =
        typeof MediaRecorder !== "undefined" &&
        "pause" in MediaRecorder.prototype;
    const wakeLockRef = useRef(null);
    const releaseWakeLock = () => {
        wakeLockRef.current?.release().catch(() => {});
        wakeLockRef.current = null;
    };
    useEffect(() => {
        const q = patientQuery.trim();
        if (q.length < 2) {
            setPatientResults([]);
            setSearchingPatient(false);
            setSearchedFor("");
            return;
        }
        setSearchingPatient(true);
        const controller = new AbortController();
        const handle = setTimeout(async () => {
            try {
                setPatientResults(await searchPatients(q, controller.signal));
                setSearchedFor(q);
            } catch (err) {
                if (err.name === "AbortError") return;
                setPatientResults([]);
                setSearchedFor(""); // a failed search must not invite adding a duplicate
            } finally {
                if (!controller.signal.aborted) setSearchingPatient(false);
            }
        }, 300);
        return () => {
            clearTimeout(handle);
            controller.abort();
        };
    }, [patientQuery]);
    useEffect(() => {
        return () => {
            if (previewPhoto) URL.revokeObjectURL(previewPhoto.url);
        };
    }, [previewPhoto]);
    useEffect(() => {
        if (showCamera && videoRef.current && cameraStreamRef.current) {
            videoRef.current.srcObject = cameraStreamRef.current;
            videoRef.current.play().catch((err) => {
                console.log("Video play() failed:", err.message);
            });
        }
    }, [showCamera]);
    const hasDraft =
        isRecording || !!file || attachments.length > 0 || scanOpen;
    useDirtyFlag(hasDraft);
    // On leave: stop recorder, release mic and camera, clear dirty flag
    useEffect(() => {
        return () => {
            clearInterval(timerRef.current);
            const rec = mediaRecorderRef.current;
            if (rec && rec.state !== "inactive") {
                rec.onstop = null;
                rec.ondataavailable = null;
                try {
                    rec.stop();
                } catch {
                    /* already stopped */
                }
                rec.stream?.getTracks().forEach((t) => t.stop());
            }
            cameraStreamRef.current?.getTracks().forEach((t) => t.stop());
            releaseWakeLock(); // new line
            // onDirtyChange?.(false);
        };
    }, []);
    // "98200 98200" -> "9820098200"; returns null if the text isn't a phone number
    const asPhone = (q) => {
        const d = q.replace(/[\s\-+()]/g, "");
        return /^\d{4,}$/.test(d) ? d : null;
    };
    const handleFiles = useCallback((fileList) => {
        const picked = fileList?.[0];
        if (!picked) return;
        setError("");
        setFile(picked);
        setFileLabel(picked.name.replace(/\.[^.]+$/, ""));
        setFilePeaks(null);
        setFileDuration(0);
        const t = ++peaksToken.current;
        decodePeaks(picked).then((p) => {
            if (t === peaksToken.current) setFilePeaks(p);
        });
    }, []);

    const triggerUpload = () => {
        if (!hasPatient) {
            setError("Select or add a patient before uploading.");
            return;
        }
        inputRef.current?.click();
    };
    const handleAttachments = (fileList) => {
        const picked = Array.from(fileList || []);
        console.log(
            "Attachment files picked:",
            picked.map((f) => `${f.name} (${f.type || "unknown type"})`),
        );
        if (picked.length === 0) {
            setError(
                "No files were selected — your browser may have filtered them out. Try a .jpg or .png.",
            );
            return;
        }
        setError("");
        setAttachments((prev) => [...prev, ...picked]);
    };
    const removeAttachment = (i) => {
        setAttachments((prev) => prev.filter((_, idx) => idx !== i));
    };
    const openCamera = async (mode = facingMode) => {
        setError("");
        cameraStreamRef.current?.getTracks().forEach((t) => t.stop());
        cameraStreamRef.current = null;
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: mode },
            });
            cameraStreamRef.current = stream;
            setFacingMode(mode);
            setShowCamera(true);
            // showCamera may already be true (mid-session switch), in which case
            // the srcObject effect below won't re-fire, so set it here too.
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                videoRef.current.play().catch((err) => {
                    console.log("Video play() failed:", err.message);
                });
            }
        } catch {
            setError(
                "Camera access was blocked. Allow it in your browser, or upload a file instead.",
            );
        }
    };

    const switchCamera = () => {
        openCamera(facingMode === "environment" ? "user" : "environment");
    };

    const closeCamera = () => {
        cameraStreamRef.current?.getTracks().forEach((t) => t.stop());
        cameraStreamRef.current = null;
        setShowCamera(false);
    };

    const capturePhoto = () => {
        const video = videoRef.current;
        if (!video) return;
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext("2d").drawImage(video, 0, 0);
        canvas.toBlob(
            (blob) => {
                if (!blob) return;
                setPreviewPhoto({ blob, url: URL.createObjectURL(blob) });
                closeCamera(); // stop the live feed while reviewing; retake reopens it
            },
            "image/jpeg",
            0.9,
        );
    };

    const retakePhoto = () => {
        if (previewPhoto) URL.revokeObjectURL(previewPhoto.url);
        setPreviewPhoto(null);
        openCamera();
    };

    const confirmPhoto = () => {
        const photo = new File(
            [previewPhoto.blob],
            `capture-${Date.now()}.jpg`,
            {
                type: "image/jpeg",
            },
        );
        setAttachments((prev) => [...prev, photo]);
        URL.revokeObjectURL(previewPhoto.url);
        setPreviewPhoto(null);
    };
    const selectPatient = (p) => {
        setSelectedPatient(p);
        setPatientQuery("");
        setPatientResults([]);
    };
    const clearPatient = () => {
        setSelectedPatient(null);
        setNewPatientSeed(null);
    };
    const changePatient = () => {
        if (isRecording) return;
        if (
            (file || attachments.length > 0) &&
            !window.confirm(
                "Changing patient removes your recording and attachments. Continue?",
            )
        ) {
            return;
        }
        setFile(null);
        setFileLabel("");
        setAttachments([]);
        setError("");
        if (inputRef.current) inputRef.current.value = "";
        setFilePeaks(null);
        setFileDuration(0);
        peaksToken.current++;
        clearPatient();
    };
    const startNewPatient = (q) => {
        const phone = asPhone(q);
        setNewPatientSeed({ name: phone ? "" : q, phone: phone || "" });
        setCreateError("");
        setPatientQuery("");
        setPatientResults([]);
    };

    const backToSearch = () => {
        setNewPatientSeed(null);
        setCreateError("");
        removeItem("form:new-patient");
    };

    const saveNewPatient = async (payload) => {
        setCreatingPatient(true);
        setCreateError("");
        try {
            const p = await createPatient(payload);
            setSelectedPatient(p);
            setNewPatientSeed(null);
            removeItem("form:new-patient");
        } catch (err) {
            setCreateError(err.message || "Couldn't add patient.");
        } finally {
            setCreatingPatient(false);
        }
    };

    const hasPatient = !!selectedPatient;
    const startRecording = async () => {
        setError("");

        if (!hasPatient) {
            setError("Select or add a patient before recording.");
            return;
        }

        if (!navigator.mediaDevices?.getUserMedia) {
            setError(
                "Microphone isn't available here — check you're on HTTPS.",
            );
            return;
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: true,
            });

            // iOS Safari doesn't support "audio/webm" — MediaRecorder throws if you
            // force an unsupported mimeType, so pick one the browser actually offers.
            const mimeType = ["audio/mp4", "audio/webm", ""].find(
                (t) => t === "" || MediaRecorder.isTypeSupported(t),
            );
            const recorder = mimeType
                ? new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
                : new MediaRecorder(stream);

            chunksRef.current = [];
            chunkIndexRef.current = 0;
            beginRecordingDraft({
                mimeType: recorder.mimeType || mimeType || "",
                startedAt: Date.now(),
                patientName: selectedPatient?.name || "",
            });
            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    chunksRef.current.push(e.data);
                    appendRecordingChunk(chunkIndexRef.current++, e.data);
                }
            };
            recorder.onstop = () => {
                const outType = recorder.mimeType || "audio/webm";
                const ext = outType.includes("mp4") ? "m4a" : "webm";
                const blob = new Blob(chunksRef.current, { type: outType });
                const recordedFile = new File(
                    [blob],
                    `consultation-${Date.now()}.${ext}`,
                    {
                        type: outType,
                    },
                );
                setFile(recordedFile);
                setFileLabel("consultation-audio");

                const activeMs =
                    activeMsRef.current +
                    (pausedRef.current ? 0 : Date.now() - segStartRef.current);
                setFilePeaks(downsample(peaksRef.current, 256));
                setFileDuration(activeMs / 1000);

                stream.getTracks().forEach((track) => track.stop());
            };
            peaksRef.current = [];
            activeMsRef.current = 0;
            segStartRef.current = Date.now();
            pausedRef.current = false;
            setIsPaused(false);
            recorder.start(1000);
            navigator.wakeLock
                ?.request("screen")
                .then((l) => (wakeLockRef.current = l))
                .catch(() => {});
            mediaRecorderRef.current = recorder;
            setIsRecording(true);
            setRecStream(stream);
            setRecordSeconds(0);
            timerRef.current = setInterval(() => {
                if (!pausedRef.current) setRecordSeconds((s) => s + 1);
            }, 1000);
        } catch (err) {
            console.log("Mic error:", err.name, err.message);
            if (err.name === "NotAllowedError") {
                setError(
                    "Microphone permission was denied. Enable it for this site in Settings, then try again.",
                );
            } else if (err.name === "NotFoundError") {
                setError("No microphone was found on this device.");
            } else if (err.name === "NotReadableError") {
                setError("The microphone is already in use by another app.");
            } else {
                setError(
                    `Microphone access failed (${err.name || "unknown error"}).`,
                );
            }
        }
    };
    const togglePause = () => {
        const rec = mediaRecorderRef.current;
        if (!rec) return;
        try {
            if (rec.state === "recording") {
                rec.pause();
                activeMsRef.current += Date.now() - segStartRef.current;
                pausedRef.current = true;
                setIsPaused(true);
            } else if (rec.state === "paused") {
                rec.resume();
                segStartRef.current = Date.now();
                pausedRef.current = false;
                setIsPaused(false);
            }
        } catch {
            setError("Couldn't pause the recording.");
        }
    };
    const stopRecording = () => {
        mediaRecorderRef.current?.stop();
        setIsRecording(false);
        setRecStream(null);
        clearInterval(timerRef.current);
        releaseWakeLock();
        setIsPaused(false);
    };

    const clearFile = () => {
        setFile(null);
        setFileLabel("");
        setError("");
        if (inputRef.current) inputRef.current.value = "";
        setFilePeaks(null);
        setFileDuration(0);
        peaksToken.current++;
    };

    const handleSubmit = () => {
        if (!selectedPatient) {
            setError("Search and select a patient.");
            return;
        }
        if (!file && attachments.length === 0) {
            setError(
                "Add a recording or at least one document before starting.",
            );
            return;
        }
        onSubmit(file, attachments, { id: selectedPatient.id }, sttProvider);
    };
    const q = patientQuery.trim();
    const showAddPrompt =
        q.length >= 2 && !searchingPatient && searchedFor === q;
    const draft = useHomeDraft({
        skip: !!initialPatient,
        selectedPatient,
        newPatientSeed,
        file,
        fileLabel,
        filePeaks,
        fileDuration,
        attachments,
        setters: {
            setSelectedPatient,
            setNewPatientSeed,
            setFile,
            setFileLabel,
            setFilePeaks,
            setFileDuration,
            setAttachments,
        },
    });
    return (
        <div className="w-full max-w-2xl mx-auto">
            <div className="bg-surface border border-line rounded-md shadow-panel p-6">
                {draft.note && (
                    <div className="mb-4 flex items-start gap-3 rounded border border-clinical-500 bg-clinical-50 px-3 py-2.5 text-sm text-ink">
                        <RotateCcw
                            size={16}
                            strokeWidth={1.75}
                            className="mt-0.5 shrink-0 text-clinical-600"
                        />
                        <p className="flex-1">{draft.note.text}</p>
                        <button
                            type="button"
                            onClick={draft.discardAll}
                            className="shrink-0 text-xs text-alert-500 underline underline-offset-2"
                        >
                            Discard
                        </button>
                        <button
                            type="button"
                            onClick={draft.dismissNote}
                            aria-label="Dismiss"
                            className="shrink-0 text-muted hover:text-ink"
                        >
                            <X size={14} strokeWidth={1.75} />
                        </button>
                    </div>
                )}
                <div className="mb-6 pb-6 border-b border-line">
                    {/* <h2 className="font-serif text-xl text-ink mb-4">
                        Patient
                    </h2> */}

                    {selectedPatient ? (
                        <div className="flex items-center gap-3 rounded border border-clinical-500 bg-clinical-50 px-4 py-3">
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
                                onClick={changePatient}
                                disabled={isRecording}
                                title={
                                    isRecording
                                        ? "Stop recording first"
                                        : undefined
                                }
                                className="text-xs text-clinical-600 underline underline-offset-2 shrink-0 disabled:opacity-40 disabled:no-underline disabled:cursor-not-allowed"
                            >
                                Change
                            </button>
                        </div>
                    ) : newPatientSeed ? (
                        <PatientForm
                            draftKey="form:new-patient"
                            initial={newPatientSeed}
                            submitLabel="Add Patient"
                            cancelLabel="Back"
                            saving={creatingPatient}
                            error={createError}
                            onSubmit={saveNewPatient}
                            onCancel={backToSearch}
                        />
                    ) : (
                        <div>
                            <SearchInput
                                value={patientQuery}
                                onChange={setPatientQuery}
                                placeholder="Search or Add patient "
                                autoFocus
                                disabled={isRecording}
                                searching={searchingPatient}
                                inputClassName="w-full rounded border border-line bg-paper px-3 py-2 text-lg text-ink placeholder:text-muted focus:border-clinical-500 outline-none"
                            />
                            {patientResults.length > 0 && (
                                <>
                                    <ul className="mt-1 rounded border border-line divide-y divide-line overflow-hidden">
                                        {patientResults.map((p) => (
                                            <li
                                                key={p.id}
                                                className="flex items-center gap-2 pr-2"
                                            >
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        onViewDetails?.(p)
                                                    }
                                                    className="min-w-0 flex-1 text-left px-3 py-3 hover:bg-paper"
                                                >
                                                    <p className="text-sm text-ink truncate">
                                                        {p.name}
                                                    </p>
                                                    <p className="text-xs text-muted">
                                                        {[
                                                            p.age != null &&
                                                                `${p.age}y`,
                                                            p.gender,
                                                            p.phone,
                                                        ]
                                                            .filter(Boolean)
                                                            .join(" · ")}
                                                    </p>
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        selectPatient(p)
                                                    }
                                                    className="shrink-0 inline-flex items-center gap-1 rounded border border-clinical-500 bg-clinical-50 px-3 py-2 text-xs font-medium text-clinical-600 hover:bg-clinical-500 hover:text-paper transition-colors"
                                                >
                                                    <Plus
                                                        size={14}
                                                        strokeWidth={2}
                                                    />
                                                    New visit
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                </>
                            )}

                            {showAddPrompt && (
                                <button
                                    type="button"
                                    onClick={() => startNewPatient(q)}
                                    className="mt-2 w-full rounded border border-clinical-500 bg-paper px-4 py-3 text-left hover:bg-clinical-50 transition-colors"
                                >
                                    <span className="mt-1 inline-flex items-center gap-1.5 text-md font-medium text-clinical-600">
                                        {asPhone(q)
                                            ? `Add a new patient with phone ${asPhone(q)}`
                                            : `Add “${q}” as a new patient`}
                                    </span>
                                </button>
                            )}
                        </div>
                    )}
                </div>
                {/* <div className="mb-4 flex items-center gap-3">
                    <label className="text-base text-ink">
                        Transcription engine
                    </label>
                    <select
                        value={sttProvider}
                        onChange={(e) => setSttProvider(e.target.value)}
                        className="rounded border border-line bg-paper px-3 py-1.5 text-sm text-ink focus:border-clinical-500 outline-none"
                    >
                        <option value="whisper">Whisper</option>
                        <option value="sarvam">Sarvam</option>
                        <option value="elevenlabs">ElevenLabs</option>
                    </select>
                </div> */}
                {/* <h2 className="font-serif text-lg text-ink mb-4">
                    add a consultation recording
                </h2> */}
                {/* <p className="text-sm text-muted mb-6">
                    Upload an audio file, or record the conversation directly in
                    your browser.
                </p> */}
                {isRecording && (
                    <div className="relative mb-4 rounded-md border border-line bg-paper px-3 py-3">
                        <LiveWaveform
                            stream={recStream}
                            peaksRef={peaksRef}
                            paused={isPaused}
                        />
                        {isPaused && (
                            <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink px-3 py-1 text-xs font-medium text-paper">
                                Paused
                            </span>
                        )}
                    </div>
                )}{" "}
                {!file && (
                    <div className="flex items-stretch gap-3">
                        {!isRecording ? (
                            <button
                                type="button"
                                onClick={startRecording}
                                disabled={!hasPatient}
                                className="flex-[7] inline-flex items-center justify-center gap-2.5 rounded-lg bg-red-600 text-white px-5 py-3 text-base font-semibold shadow-sm hover:bg-red-700 active:bg-red-800 transition-colors disabled:hover:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-red-600"
                            >
                                <Mic size={26} strokeWidth={2} />
                                Start
                            </button>
                        ) : (
                            <button
                                type="button"
                                onClick={stopRecording}
                                className="flex-[7] inline-flex items-center justify-center gap-2.5 rounded-lg bg-red-600 text-white px-5 py-3 text-base font-semibold shadow-sm hover:bg-red-700 active:bg-red-800 transition-colors "
                            >
                                <Square
                                    size={22}
                                    strokeWidth={2}
                                    fill="currentColor"
                                />
                                Stop {formatDuration(recordSeconds)}
                            </button>
                        )}
                        {isRecording && canPause && (
                            <button
                                type="button"
                                onClick={togglePause}
                                aria-label={
                                    isPaused
                                        ? "Resume recording"
                                        : "Pause recording"
                                }
                                className={`flex-[2] inline-flex items-center justify-center gap-1.5 rounded-lg border px-5 py-3 text-base font-semibold transition-colors ${
                                    isPaused
                                        ? "border-clinical-500 bg-clinical-500 text-paper hover:bg-clinical-600"
                                        : "border-line bg-paper text-ink hover:bg-clinical-50"
                                }`}
                            >
                                {isPaused ? (
                                    <Play size={20} strokeWidth={1.75} />
                                ) : (
                                    <Pause size={20} strokeWidth={1.75} />
                                )}
                                <span className="hidden sm:inline">
                                    {isPaused ? "Resume" : "Pause"}
                                </span>
                            </button>
                        )}

                        {!isRecording && (
                            <button
                                type="button"
                                onClick={triggerUpload}
                                disabled={!hasPatient}
                                className="flex-[3] inline-flex items-center justify-center gap-1.5 rounded-lg border border-line bg-paper text-ink px-3 py-3 text-xs hover:bg-clinical-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-paper"
                            >
                                <UploadCloud size={18} strokeWidth={1.75} />
                                Upload
                            </button>
                        )}
                        <input
                            ref={inputRef}
                            type="file"
                            accept="audio/*"
                            className="hidden"
                            onChange={(e) => handleFiles(e.target.files)}
                        />
                    </div>
                )}
                {!file && !hasPatient && (
                    <p className="mt-2 text-xs text-muted">
                        Select or add a patient above to enable recording.
                    </p>
                )}
                {file && (
                    <AudioPlayer
                        file={file}
                        peaks={filePeaks}
                        durationHint={fileDuration}
                        label={
                            fileLabel === "consultation-audio" ? "" : fileLabel
                        }
                        onRemove={clearFile}
                    />
                )}
                <div className="mt-6">
                    <p className="text-base text-ink mb-2">
                        Attach reports or prescriptions
                    </p>
                    <label className="flex items-center gap-2 rounded border border-dashed border-line px-4 py-3 text-sm text-clinical-600 cursor-pointer hover:bg-paper">
                        <Paperclip size={16} strokeWidth={1.75} />
                        Add images or PDFs
                        <input
                            type="file"
                            accept="image/*,.jpg,.jpeg,.png,.webp,.heic,.heif,application/pdf,.pdf"
                            multiple
                            className="hidden"
                            onChange={(e) => {
                                handleAttachments(e.target.files);
                                e.target.value = "";
                            }}
                        />
                    </label>
                    <button
                        type="button"
                        onClick={() => {
                            const phone =
                                window.matchMedia?.(
                                    "(pointer: coarse)",
                                ).matches;
                            if (phone) nativeCamRef.current?.click();
                            else openCamera();
                        }}
                        className="flex items-center w-full gap-2 rounded border border-dashed border-line px-4 py-3 text-sm text-clinical-600 hover:bg-paper"
                    >
                        <Camera size={16} strokeWidth={1.75} />
                        Camera
                    </button>
                    <button
                        type="button"
                        onClick={() => setScanOpen(true)}
                        className="flex w-full items-center gap-2 rounded border border-dashed border-line px-4 py-3 text-sm text-clinical-600 hover:bg-paper"
                    >
                        <ScanLine size={16} strokeWidth={1.75} />
                        Scan pages
                    </button>
                    <input
                        ref={nativeCamRef}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        onChange={(e) => {
                            handleAttachments(e.target.files);
                            e.target.value = "";
                        }}
                    />

                    {attachments.length > 0 && (
                        <ul className="mt-3 space-y-2">
                            {attachments.map((a, i) => (
                                <li
                                    key={i}
                                    className="flex items-center gap-3 rounded border border-line bg-paper px-3 py-2"
                                >
                                    <FileText
                                        size={16}
                                        className="text-clinical-600 shrink-0"
                                        strokeWidth={1.75}
                                    />
                                    <span className="text-sm text-ink truncate flex-1">
                                        {a.name}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => removeAttachment(i)}
                                        className="text-muted hover:text-ink"
                                    >
                                        <X size={14} strokeWidth={1.75} />
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
                {scanOpen && (
                    <ScanPages
                        output="images"
                        onClose={() => setScanOpen(false)}
                        onDone={(files) => {
                            setAttachments((prev) => [...prev, ...files]);
                            setScanOpen(false);
                        }}
                    />
                )}
                {showCamera && (
                    <div className="fixed inset-0 z-50 bg-ink/90 flex flex-col items-center justify-center p-4">
                        <video
                            ref={videoRef}
                            muted
                            autoPlay
                            playsInline
                            className="max-h-[70vh] rounded-md"
                        />
                        <div className="flex gap-3 mt-6">
                            <button
                                type="button"
                                onClick={closeCamera}
                                className="rounded border border-line bg-surface px-5 py-2.5 text-sm text-ink"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={switchCamera}
                                aria-label="Switch camera"
                                className="rounded border border-line bg-surface px-5 py-2.5 text-sm text-ink inline-flex items-center gap-2"
                            >
                                <SwitchCamera size={16} strokeWidth={1.75} />
                                Flip
                            </button>
                            <button
                                type="button"
                                onClick={capturePhoto}
                                className="rounded bg-clinical-500 text-paper px-5 py-2.5 text-sm font-medium hover:bg-clinical-600"
                            >
                                Capture
                            </button>
                        </div>
                    </div>
                )}
                {previewPhoto && (
                    <div className="fixed inset-0 z-50 bg-ink/90 flex flex-col items-center justify-center p-4">
                        <img
                            src={previewPhoto.url}
                            alt="Captured document"
                            className="max-h-[70vh] rounded-md"
                        />
                        <div className="flex gap-3 mt-6">
                            <button
                                type="button"
                                onClick={retakePhoto}
                                className="rounded border border-line bg-surface px-5 py-2.5 text-sm text-ink"
                            >
                                Retake
                            </button>
                            <button
                                type="button"
                                onClick={confirmPhoto}
                                className="rounded bg-clinical-500 text-paper px-5 py-2.5 text-sm font-medium hover:bg-clinical-600"
                            >
                                Use photo
                            </button>
                        </div>
                    </div>
                )}
                {error && (
                    <p className="mt-4 text-sm text-alert-500">{error}</p>
                )}
                <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={
                        isRecording ||
                        (!file && attachments.length === 0) ||
                        !selectedPatient
                    }
                    className="mt-6 flex w-full items-center justify-center gap-2 rounded bg-clinical-500 text-paper py-3 text-base font-medium hover:bg-clinical-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                    <Sparkles size={18} strokeWidth={1.75} />
                    Generate summary
                </button>
            </div>
        </div>
    );
}
