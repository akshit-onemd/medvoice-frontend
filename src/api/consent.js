import { API_BASE_URL, authFetch } from "./processAudio";

async function call(path, options) {
    const res = await authFetch(`${API_BASE_URL}${path}`, options);
    let body = {};
    try {
        body = await res.json();
    } catch {
        /* non-JSON error body */
    }
    if (!res.ok) {
        const err = new Error(body.error || `Request failed (${res.status})`);
        err.code = body.code;
        err.status = res.status;
        throw err;
    }
    return body;
}

const json = (data) => ({
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
});

export const getConsentNotice = () => call("/consent/notice");
export const getConsent = (patientId) => call(`/patients/${patientId}/consent`);
export const submitConsent = (patientId, payload) =>
    call(`/patients/${patientId}/consent`, json(payload));
export const withdrawConsent = (patientId) =>
    call(`/patients/${patientId}/consent/withdraw`, json({}));
