import { forget, peek, revalidate, useCached } from "../utils/cache";
import { getConsultation, getPatientConsultations, getPatientSummary } from "./processAudio";

// Patient page data, kept for the browser tab so reopening a patient or a
// visit is instant. Lists refresh quietly on every open; a full consultation
// is dropped whenever anything is saved (see authFetch), so an edited note
// is never shown from an old copy.
const visitsKey = (id) => `patient:${id}:visits`;
const summaryKey = (id) => `patient:${id}:summary`;
const noteKey = (id) => `consultation:${id}`;
const KEEP_NOTES = 20; // full notes can be large (transcripts)

export const usePatientVisits = (id) =>
    useCached(id ? visitsKey(id) : null, () => getPatientConsultations(id));
export const usePatientSummary = (id) =>
    useCached(id ? summaryKey(id) : null, () => getPatientSummary(id));

// Start loading a patient page before it opens (on hover / touch)
export function prefetchPatient(id) {
    if (!id) return;
    if (peek(visitsKey(id)) === undefined)
        revalidate(visitsKey(id), () => getPatientConsultations(id)).catch(() => {});
    if (peek(summaryKey(id)) === undefined)
        revalidate(summaryKey(id), () => getPatientSummary(id)).catch(() => {});
}

const kept = [];
function remember(id) {
    const i = kept.indexOf(id);
    if (i >= 0) kept.splice(i, 1);
    kept.push(id);
    while (kept.length > KEEP_NOTES) forget(noteKey(kept.shift()));
}

// The cached copy at once if there is one, otherwise fetched
export function loadConsultation(id) {
    const have = peek(noteKey(id));
    if (have !== undefined) {
        remember(id);
        return Promise.resolve(have);
    }
    return revalidate(noteKey(id), () => getConsultation(id)).then((d) => {
        remember(id);
        return d;
    });
}

// Quietly load the latest few visits so opening them is instant
export const prefetchConsultations = (ids) =>
    Promise.all(ids.map((id) => loadConsultation(id).catch(() => null)));

export function forgetPatientCache() {
    forget("patient:");
    forget("consultation:");
    kept.length = 0;
}
