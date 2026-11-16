// Whether a note has anything worth printing or billing. Blank placeholder rows, fixed
// vitals without values, checklist item names and code fields don't count.
const SKIP = /(_code|_codes|_term|_verified|_corrected|_pending|_alts)$|^umls|^item$|^units$/;
const LISTS = [
    "allergies",
    "conditions",
    "medication_history",
    "investigation_history",
    "procedures",
    "system_review",
    "family_history",
    "lifestyle_habits",
    "social_history",
    "other_history",
];

function filled(v) {
    if (v === null || v === undefined) return false;
    if (typeof v === "string") return v.trim() !== "";
    if (typeof v === "number") return true;
    if (Array.isArray(v)) return v.some(filled);
    if (typeof v === "object")
        return Object.entries(v).some(([k, x]) => !SKIP.test(k) && filled(x));
    return false;
}

export function noteHasContent(sd) {
    if (!sd || typeof sd !== "object") return false;
    const rx = sd.prescription || {};
    if (["symptoms", "medications", "diagnosis", "followup"].some((k) => filled(rx[k]))) return true;
    if (LISTS.some((k) => filled(sd[k]))) return true;
    if (Array.isArray(sd.vitals) && sd.vitals.some((v) => filled(v?.value))) return true;
    if (sd.custom && typeof sd.custom === "object" && Object.values(sd.custom).some(filled)) return true;
    return false;
}

export const EMPTY_NOTE_MESSAGE = "Nothing to print yet. Add details to the note first.";
