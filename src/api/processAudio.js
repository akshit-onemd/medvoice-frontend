// Backend base URL — change this if your server.js runs elsewhere.
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api";

// The backend (server.js) only replies once, at the very end, with the
// full result. It does not stream progress. To give the user real
// feedback while Whisper transcribes and Ollama extracts data (which
// together can take anywhere from a few seconds to over a minute), we
// advance through these stages on a timer, and jump straight to
// "done" the moment the real response comes back — whichever happens
// first. This keeps the UI honest: if the backend responds early, the
// UI catches up immediately instead of waiting out a fake timer.
export const PROCESSING_STAGES = [
    { key: "upload", label: "Uploading recording", estimateMs: 1500 },
    {
        key: "transcribe",
        label: "Transcribing speech to text",
        estimateMs: 9000,
    },
    {
        key: "attachments",
        label: "Reading attached documents",
        estimateMs: 4000,
    },
    { key: "extract", label: "Extracting clinical details", estimateMs: 12000 },
    {
        key: "verify",
        label: "Verifying medical codes against UMLS",
        estimateMs: 6000,
    },

    { key: "finalize", label: "Preparing your summary", estimateMs: 2000 },
];
let getTokenFn = null;
export function setAuthTokenGetter(fn) {
    getTokenFn = fn;
}

export async function authFetch(url, options = {}) {
    const token = getTokenFn ? await getTokenFn() : null;
    return fetch(url, {
        ...options,
        headers: {
            ...(options.headers || {}),
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
    });
}
export async function searchPatients(query, signal) {
    const res = await authFetch(
        `${API_BASE_URL}/patients/search?query=${encodeURIComponent(query)}`,
        { signal },
    );
    if (!res.ok) throw new Error("Patient search failed");
    const data = await res.json();
    return data.patients || [];
}

export async function getPatientConsultations(patientId) {
    const res = await authFetch(
        `${API_BASE_URL}/patients/${patientId}/consultations`,
    );
    if (!res.ok) throw new Error("Failed to load consultations");
    const data = await res.json();
    return data.consultations || [];
}

export async function getConsultation(consultationId) {
    const res = await authFetch(
        `${API_BASE_URL}/consultations/${consultationId}`,
    );
    if (!res.ok) throw new Error("Failed to load consultation");
    return res.json();
}
export async function getPatientSummary(patientId) {
    const res = await authFetch(
        `${API_BASE_URL}/patients/${patientId}/summary`,
    );
    if (!res.ok) throw new Error("Failed to load patient summary");
    const data = await res.json();
    return data.patient_summary || { overview: "", details: [] };
}
/**
 * Uploads an audio file to the backend and reports simulated stage
 * progress via onStageChange(stageIndex) while the real request is
 * in flight. Resolves with the parsed JSON body on success.
 */
export async function processAudio(
    file,
    attachments = [],
    patientInfo,
    sttProvider = "elevenlabs",
    onStageChange,
) {
    const formData = new FormData();
    if (file) formData.append("file", file, file.name || "recording.webm");
    attachments.forEach((att) => formData.append("attachments", att, att.name));
    formData.append("stt_provider", sttProvider);

    if (patientInfo.id) {
        formData.append("patient_id", patientInfo.id);
    } else {
        formData.append("patient_name", patientInfo.name);
        formData.append("patient_phone", patientInfo.phone);
        if (patientInfo.age) formData.append("patient_age", patientInfo.age);
        if (patientInfo.gender)
            formData.append("patient_gender", patientInfo.gender);
    }
    let cancelled = false;
    let currentStage = 0;
    onStageChange?.(0);

    const timers = [];
    let elapsed = 0;
    for (let i = 1; i < PROCESSING_STAGES.length; i++) {
        elapsed += PROCESSING_STAGES[i - 1].estimateMs;
        const stageIndex = i;
        const timer = setTimeout(() => {
            if (!cancelled) {
                currentStage = stageIndex;
                onStageChange?.(stageIndex);
            }
        }, elapsed);
        timers.push(timer);
    }

    const clearAllTimers = () => timers.forEach(clearTimeout);

    try {
        const response = await authFetch(`${API_BASE_URL}/process-audio`, {
            method: "POST",
            body: formData,
        });

        cancelled = true;
        clearAllTimers();
        onStageChange?.(PROCESSING_STAGES.length - 1);

        let body;
        try {
            body = await response.json();
        } catch {
            throw new Error(
                "The server sent back a response that wasn't valid JSON.",
            );
        }

        if (!response.ok) {
            throw new Error(
                body?.error || `Request failed with status ${response.status}`,
            );
        }

        return body;
    } catch (err) {
        cancelled = true;
        clearAllTimers();
        if (err instanceof TypeError) {
            throw new Error(
                `Couldn't reach the server at ${API_BASE_URL}. Make sure server.js is running.`,
            );
        }
        throw err;
    }
}
let doctorProfileCache = null;

export async function getDoctorProfile({ force = false } = {}) {
    if (doctorProfileCache && !force) return doctorProfileCache;
    const res = await authFetch(`${API_BASE_URL}/doctor/profile`);
    if (!res.ok) throw new Error("Failed to load doctor profile");
    const data = await res.json();
    doctorProfileCache = data.profile;
    return data.profile;
}

export async function saveDoctorProfile(profile) {
    const res = await authFetch(`${API_BASE_URL}/doctor/profile`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || "Failed to save profile");
    doctorProfileCache = body.profile;
    return body.profile;
}
export async function updatePrescription(consultationId, prescription) {
    const res = await authFetch(
        `${API_BASE_URL}/consultations/${consultationId}/prescription`,
        {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prescription }),
        },
    );
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || "Failed to save changes");
    return body; // { prescription, consultation_summary }
}

export async function updateSection(consultationId, key, payload) {
    const res = await authFetch(
        `${API_BASE_URL}/consultations/${consultationId}/section/${key}`,
        {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ [key]: payload }),
        },
    );
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || "Failed to save changes");
    return body; // { [key]: ..., consultation_summary }
}