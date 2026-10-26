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
const GENERIC_ERROR = "Something went wrong. Please try again.";

export async function processAudio(
    file,
    attachments = [],
    patientInfo,
    sttProvider = "elevenlabs",
    onStageChange,
    retry = null, // { transcript, diarizedTranscript, language } from a failed run
) {
    const formData = new FormData();
    if (retry?.transcript) {
        formData.append("transcript", retry.transcript);
        if (retry.diarizedTranscript)
            formData.append("diarized_transcript", retry.diarizedTranscript);
        if (retry.language) formData.append("language", retry.language);
    } else if (file) {
        formData.append("file", file, file.name || "recording.webm");
    }
    attachments.forEach((att) => formData.append("attachments", att, att.name));
    formData.append("stt_provider", sttProvider);
    formData.append("patient_id", patientInfo.id);

    let cancelled = false;
    onStageChange?.(0);

    const timers = [];
    let elapsed = 0;
    for (let i = 1; i < PROCESSING_STAGES.length; i++) {
        elapsed += PROCESSING_STAGES[i - 1].estimateMs;
        const stageIndex = i;
        timers.push(
            setTimeout(() => {
                if (!cancelled) onStageChange?.(stageIndex);
            }, elapsed),
        );
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

        let body = null;
        try {
            body = await response.json();
        } catch {
            body = null;
        }

        if (!response.ok) {
            const e = new Error(GENERIC_ERROR);
            if (body?.error === "generation_failed") {
                e.code = "generation_failed";
                e.stage = body.stage || "other";
                e.transcript = body.transcript || null;
                e.diarizedTranscript = body.diarizedTranscript || null;
                e.language = body.language || null;
                throw e;
            }
            // 4xx carries a message meant to be read, such as "Patient not found"
            if (response.status < 500 && body?.error)
                throw new Error(body.error);
            throw e;
        }
        if (!body) throw new Error(GENERIC_ERROR);
        return body;
    } catch (err) {
        cancelled = true;
        clearAllTimers();
        if (err instanceof TypeError) throw new Error(GENERIC_ERROR); // network failure
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
export async function saveLetterhead({ image_data, top_pct, bottom_pct }) {
    const res = await authFetch(`${API_BASE_URL}/doctor/letterhead`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image_data, top_pct, bottom_pct }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || "Failed to save letterhead");
    doctorProfileCache = body.profile; // keeps the cached profile (used by PDF downloads) current
    return body.profile;
}
export async function getMe() {
    const res = await authFetch(`${API_BASE_URL}/me`);
    if (!res.ok) throw new Error("Couldn't load your account");
    return res.json(); // { role, doctor_name? }
}

export async function createPatient(patient) {
    const res = await authFetch(`${API_BASE_URL}/patients`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patient),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || "Failed to add patient");
    return body.patient;
}

export async function updatePatient(id, patient) {
    const res = await authFetch(`${API_BASE_URL}/patients/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patient),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || "Failed to update patient");
    return body.patient;
}
export function primeDoctorProfile(p) {
    doctorProfileCache = p;
}
export async function listPatients({
    q = "",
    offset = 0,
    limit = 20,
    signal,
} = {}) {
    const params = new URLSearchParams({
        q,
        offset: String(offset),
        limit: String(limit),
    });
    const res = await authFetch(`${API_BASE_URL}/patients?${params}`, {
        signal,
    });
    if (!res.ok) throw new Error("Failed to load patients");
    return res.json(); // { patients, hasMore }
}
async function rcFetch(method, path, body) {
    const res = await authFetch(`${API_BASE_URL}${path}`, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Request failed");
    return data;
}

export const getRateCard = () => rcFetch("GET", "/rate-card");
export const createTax = (b) => rcFetch("POST", "/taxes", b);
export const updateTax = (id, b) => rcFetch("PUT", `/taxes/${id}`, b);
export const deleteTax = (id) => rcFetch("DELETE", `/taxes/${id}`);
export const createService = (b) => rcFetch("POST", "/services", b);
export const updateService = (id, b) => rcFetch("PUT", `/services/${id}`, b);
export const deleteService = (id) => rcFetch("DELETE", `/services/${id}`);
export const getPendingServices = async (patientId) =>
    (await rcFetch("GET", `/patients/${patientId}/pending-services`)).items;
export const setPendingServices = async (patientId, items) =>
    (await rcFetch("PUT", `/patients/${patientId}/pending-services`, { items }))
        .items;
export const getConsultationServices = (id) =>
    rcFetch("GET", `/consultations/${id}/services`); // { items, source }
export const saveConsultationServices = async (id, items) =>
    (await rcFetch("PUT", `/consultations/${id}/services`, { items })).items;
export const createBill = async (consultationId) =>
    (await rcFetch("POST", `/consultations/${consultationId}/bill`, {})).bill;
export async function saveBillLetterhead(payload) {
    const res = await authFetch(`${API_BASE_URL}/doctor/bill-letterhead`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok)
        throw new Error(body.error || "Failed to save bill letterhead");
    doctorProfileCache = body.profile;
    return body.profile;
}
export const createBundle = (b) => rcFetch("POST", "/bundles", b);
export const updateBundle = (id, b) => rcFetch("PUT", `/bundles/${id}`, b);
export const deleteBundle = (id) => rcFetch("DELETE", `/bundles/${id}`);
export const generateSuggestionFor = (id) =>
    rcFetch("POST", `/consultations/${id}/suggestion`, {});
export const setSuggestionStatus = (id, status) =>
    rcFetch("PUT", `/consultations/${id}/suggestion`, { status });
export async function parseVoice(blob, section, consultationId = "") {
    const fd = new FormData();
    fd.append(
        "audio",
        blob,
        `voice.${(blob.type || "").includes("mp4") ? "m4a" : "webm"}`,
    );
    fd.append("section", section);
    if (consultationId) fd.append("consultation_id", consultationId);
    const res = await authFetch(`${API_BASE_URL}/voice/parse`, {
        method: "POST",
        body: fd,
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok)
        throw new Error(
            body.error ||
                "Couldn't understand the recording. Please try again.",
        );
    return body; // { heard, language, rows, edits, empty }
}

export const applyVoiceRows = (id, rows, edits = []) =>
    rcFetch("POST", `/consultations/${id}/voice/apply`, { rows, edits });
export const refreshSummary = (id) =>
    rcFetch("POST", `/consultations/${id}/summary/refresh`, {});
export const searchCodes = (vocab, q) =>
    rcFetch(
        "GET",
        `/codes/search?vocab=${encodeURIComponent(vocab)}&q=${encodeURIComponent(q)}`,
    );
export const saveCodes = (consultationId, changes) =>
    rcFetch("PUT", `/consultations/${consultationId}/code`, { changes });
export const approveSuggestion = (id, ids, brands = {}) =>
    rcFetch("POST", `/consultations/${id}/suggestion/approve`, { ids, brands });
export const lookupBrands = (items) =>
    rcFetch("POST", "/brands/lookup", { items });
export const searchBrandMedicines = (q) =>
    rcFetch("GET", `/brands/medicines?q=${encodeURIComponent(q)}`);
export const getBrandFamilies = (ing) =>
    rcFetch("GET", `/brands/families?ing=${encodeURIComponent(ing)}`);
export const getBrandPrefs = () => rcFetch("GET", "/brand-prefs");
export const saveBrandPrefs = (ing_key, families) =>
    rcFetch("PUT", "/brand-prefs", { ing_key, families });
export const setBrandFavourite = (ing_key, family, favourite) =>
    rcFetch("PUT", "/brand-prefs/favourite", { ing_key, family, favourite });
