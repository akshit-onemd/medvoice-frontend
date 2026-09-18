import React, { useCallback, useRef, useState, useEffect } from "react";
import {
    Mic,
    Square,
    UploadCloud,
    FileAudio,
    X,
    Stethoscope,
    Paperclip,
    FileText,
    Camera,
} from "lucide-react";
import { API_BASE_URL } from "../api/processAudio";
const ACCEPTED_TYPES = [".mp3", ".wav", ".m4a", ".webm", ".ogg"];

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

export default function UploadPanel({ onSubmit }) {
    const [file, setFile] = useState(null);
    const [isDragging, setIsDragging] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [recordSeconds, setRecordSeconds] = useState(0);
    const [error, setError] = useState("");
    const [attachments, setAttachments] = useState([]);
    const inputRef = useRef(null);
    const mediaRecorderRef = useRef(null);
    const chunksRef = useRef([]);
    const timerRef = useRef(null);
    const [showCamera, setShowCamera] = useState(false);
    const videoRef = useRef(null);
    const cameraStreamRef = useRef(null);
    const [previewPhoto, setPreviewPhoto] = useState(null); // { blob, url }
    const [patientQuery, setPatientQuery] = useState("");
    const [patientResults, setPatientResults] = useState([]);
    const [searchingPatient, setSearchingPatient] = useState(false);
    const [selectedPatient, setSelectedPatient] = useState(null);
    const [showNewPatientForm, setShowNewPatientForm] = useState(false);
    const [newName, setNewName] = useState("");
    const [newAge, setNewAge] = useState("");
    const [newGender, setNewGender] = useState("");
    const [newPhone, setNewPhone] = useState("");
    const [sttProvider, setSttProvider] = useState("whisper");
    useEffect(() => {
        if (patientQuery.trim().length < 2) {
            setPatientResults([]);
            return;
        }
        setSearchingPatient(true);
        const handle = setTimeout(async () => {
            try {
                const res = await fetch(
                    `${API_BASE_URL}/patients/search?query=${encodeURIComponent(patientQuery.trim())}`,
                );
                const data = await res.json();
                setPatientResults(data.patients || []);
            } catch {
                setPatientResults([]);
            } finally {
                setSearchingPatient(false);
            }
        }, 350);
        return () => clearTimeout(handle);
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
    const handleFiles = useCallback((fileList) => {
        const picked = fileList?.[0];
        if (!picked) return;
        setError("");
        setFile(picked);
    }, []);
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
    const onDrop = (e) => {
        e.preventDefault();
        setIsDragging(false);
        handleFiles(e.dataTransfer.files);
    };
    const openCamera = async () => {
        setError("");
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: "environment" },
            });
            cameraStreamRef.current = stream;
            setShowCamera(true);
            // video element isn't mounted yet on this render, so wait a tick
        } catch {
            setError(
                "Camera access was blocked. Allow it in your browser, or upload a file instead.",
            );
        }
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
        setShowNewPatientForm(false);
    };
    const startRecording = async () => {
        setError("");

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
            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) chunksRef.current.push(e.data);
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
                stream.getTracks().forEach((track) => track.stop());
            };

            recorder.start();
            mediaRecorderRef.current = recorder;
            setIsRecording(true);
            setRecordSeconds(0);
            timerRef.current = setInterval(
                () => setRecordSeconds((s) => s + 1),
                1000,
            );
        } catch (err) {
            console.log("Mic error:", err.name, err.message);
            if (err.name === "NotAllowedError") {
                setError(
                    "Microphone permission was denied. Enable it for this site in Settings → Safari → Camera & Microphone, then try again.",
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

    const stopRecording = () => {
        mediaRecorderRef.current?.stop();
        setIsRecording(false);
        clearInterval(timerRef.current);
    };

    const clearFile = () => {
        setFile(null);
        setError("");
        if (inputRef.current) inputRef.current.value = "";
    };

    const handleSubmit = () => {
        const hasNewPatient =
            showNewPatientForm && newName.trim() && newPhone.trim();
        if (!selectedPatient && !hasNewPatient) {
            setError(
                "Select an existing patient, or add a new one with a name and phone number.",
            );
            return;
        }
        if (!file && attachments.length === 0) {
            setError(
                "Add a recording or at least one document before starting.",
            );
            return;
        }
        const patientInfo = selectedPatient
            ? { id: selectedPatient.id }
            : {
                  name: newName.trim(),
                  age: newAge,
                  gender: newGender,
                  phone: newPhone.trim(),
              };
        onSubmit(file, attachments, patientInfo, sttProvider);
    };
    return (
        <div className="w-full max-w-2xl mx-auto">
            <div className="flex items-center gap-3 mb-8">
                <div className="flex h-10 w-10 items-center justify-center rounded bg-clinical-500 text-paper">
                    <Stethoscope size={20} strokeWidth={1.75} />
                </div>
                <div>
                    <h1 className="font-serif text-2xl text-ink leading-tight">
                        MedVoice
                    </h1>
                    <p className="text-sm text-muted">
                        Consultation audio to structured chart notes
                    </p>
                </div>
            </div>

            <div className="bg-surface border border-line rounded-md shadow-panel p-8">
                <div className="mb-6 pb-6 border-b border-line">
                    <h2 className="font-serif text-lg text-ink mb-4">
                        Patient
                    </h2>

                    {selectedPatient ? (
                        <div className="flex items-center gap-3 rounded border border-clinical-500 bg-clinical-50 px-4 py-3">
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
                                onClick={clearPatient}
                                className="text-xs text-clinical-600 underline underline-offset-2 shrink-0"
                            >
                                Change
                            </button>
                        </div>
                    ) : showNewPatientForm ? (
                        <div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <input
                                    type="text"
                                    placeholder="Full name"
                                    value={newName}
                                    onChange={(e) => setNewName(e.target.value)}
                                    className="rounded border border-line bg-paper px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-clinical-500 outline-none"
                                />
                                <input
                                    type="tel"
                                    placeholder="Phone number"
                                    value={newPhone}
                                    onChange={(e) =>
                                        setNewPhone(e.target.value)
                                    }
                                    className="rounded border border-line bg-paper px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-clinical-500 outline-none"
                                />
                                <input
                                    type="number"
                                    placeholder="Age"
                                    value={newAge}
                                    onChange={(e) => setNewAge(e.target.value)}
                                    className="rounded border border-line bg-paper px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-clinical-500 outline-none"
                                />
                                <select
                                    value={newGender}
                                    onChange={(e) =>
                                        setNewGender(e.target.value)
                                    }
                                    className="rounded border border-line bg-paper px-3 py-2 text-sm text-ink focus:border-clinical-500 outline-none"
                                >
                                    <option value="">Gender</option>
                                    <option value="male">Male</option>
                                    <option value="female">Female</option>
                                    <option value="other">Other</option>
                                </select>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowNewPatientForm(false)}
                                className="text-xs text-muted underline underline-offset-2 mt-2"
                            >
                                Search existing patient instead
                            </button>
                        </div>
                    ) : (
                        <div>
                            <input
                                type="text"
                                placeholder="Search by name or phone"
                                value={patientQuery}
                                onChange={(e) =>
                                    setPatientQuery(e.target.value)
                                }
                                className="w-full rounded border border-line bg-paper px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-clinical-500 outline-none"
                            />
                            {searchingPatient && (
                                <p className="text-xs text-muted mt-2">
                                    Searching…
                                </p>
                            )}
                            {patientResults.length > 0 && (
                                <ul className="mt-2 rounded border border-line divide-y divide-line overflow-hidden">
                                    {patientResults.map((p) => (
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
                            {patientQuery.trim().length >= 2 &&
                                !searchingPatient &&
                                patientResults.length === 0 && (
                                    <p className="text-xs text-muted mt-2">
                                        No matching patient found.
                                    </p>
                                )}
                            <button
                                type="button"
                                onClick={() => setShowNewPatientForm(true)}
                                className="text-xs text-clinical-600 underline underline-offset-2 mt-2"
                            >
                                + Add new patient
                            </button>
                        </div>
                    )}
                </div>
                <div className="mb-4 flex items-center gap-3">
                    <label className="text-sm text-ink">
                        Transcription engine
                    </label>
                    <select
                        value={sttProvider}
                        onChange={(e) => setSttProvider(e.target.value)}
                        className="rounded border border-line bg-paper px-3 py-1.5 text-sm text-ink focus:border-clinical-500 outline-none"
                    >
                        <option value="whisper">Whisper</option>
                        <option value="sarvam">Sarvam</option>
                        <option value="elevenlabs">
                            ElevenLabs
                        </option>
                    </select>{" "}
                </div>
                <h2 className="font-serif text-lg text-ink mb-1">
                    Add a consultation recording
                </h2>
                <p className="text-sm text-muted mb-6">
                    Upload an audio file, or record the conversation directly in
                    your browser.
                </p>

                {!file && (
                    <div
                        onDragOver={(e) => {
                            e.preventDefault();
                            setIsDragging(true);
                        }}
                        onDragLeave={() => setIsDragging(false)}
                        onDrop={onDrop}
                        className={`rounded-md border-2 border-dashed p-10 text-center transition-colors ${
                            isDragging
                                ? "border-clinical-500 bg-clinical-50"
                                : "border-line bg-paper"
                        }`}
                    >
                        <UploadCloud
                            className="mx-auto mb-3 text-clinical-500"
                            size={28}
                            strokeWidth={1.5}
                        />
                        <p className="text-sm text-ink mb-1">
                            Drag an audio file here, or{" "}
                            <button
                                type="button"
                                onClick={() => inputRef.current?.click()}
                                className="text-clinical-600 underline underline-offset-2 hover:text-clinical-700"
                            >
                                browse your files
                            </button>
                        </p>
                        <p className="text-xs text-muted">
                            Supports {ACCEPTED_TYPES.join(", ")}
                        </p>
                        <input
                            ref={inputRef}
                            type="file"
                            accept="audio/*"
                            className="hidden"
                            onChange={(e) => handleFiles(e.target.files)}
                        />

                        <div className="flex items-center gap-3 my-6">
                            <div className="h-px flex-1 bg-line" />
                            <span className="text-xs text-muted">or</span>
                            <div className="h-px flex-1 bg-line" />
                        </div>

                        {!isRecording ? (
                            <button
                                type="button"
                                onClick={startRecording}
                                className="inline-flex items-center gap-2 rounded bg-ink text-paper px-4 py-2.5 text-sm hover:bg-clinical-700 transition-colors"
                            >
                                <Mic size={16} strokeWidth={1.75} />
                                Record from microphone
                            </button>
                        ) : (
                            <button
                                type="button"
                                onClick={stopRecording}
                                className="inline-flex items-center gap-2 rounded bg-alert-400 text-paper px-4 py-2.5 text-sm hover:bg-alert-500 transition-colors"
                            >
                                <Square
                                    size={14}
                                    strokeWidth={1.75}
                                    fill="currentColor"
                                />
                                Stop recording · {formatDuration(recordSeconds)}
                            </button>
                        )}
                    </div>
                )}

                {file && (
                    <div className="rounded-md border border-line bg-paper p-4 flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-clinical-50 text-clinical-600">
                            <FileAudio size={18} strokeWidth={1.75} />
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="text-sm text-ink truncate">
                                {file.name}
                            </p>
                            <p className="text-xs text-muted">
                                {formatSize(file.size)}
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={clearFile}
                            className="text-muted hover:text-ink p-1"
                            aria-label="Remove file"
                        >
                            <X size={16} strokeWidth={1.75} />
                        </button>
                    </div>
                )}
                <div className="mt-6">
                    <p className="text-sm text-ink mb-2">
                        Attach reports or prescriptions (optional)
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
                        onClick={openCamera}
                        className="flex items-center gap-2 rounded border border-dashed border-line px-4 py-3 text-sm text-clinical-600 hover:bg-paper"
                    >
                        <Camera size={16} strokeWidth={1.75} />
                        Camera
                    </button>

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
                                    <span className="text-xs text-ink truncate flex-1">
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
                        (!file && attachments.length === 0) ||
                        (!selectedPatient &&
                            !(
                                showNewPatientForm &&
                                newName.trim() &&
                                newPhone.trim()
                            ))
                    }
                    className="mt-6 w-full rounded bg-clinical-500 text-paper py-3 text-sm font-medium hover:bg-clinical-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                    Generate summary
                </button>
            </div>
        </div>
    );
}
