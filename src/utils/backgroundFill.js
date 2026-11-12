// After an upload, the server saves the record first and adds the codes and the AI plan a few
// seconds later. These helpers bring those late arrivals into the page without touching
// anything the doctor has changed in the meantime. (The server uses the same rules.)

// Every code field: snomed_ct_code, icd10_codes_verified, loinc_code_status, snomed_ct_term ...
const CODE_FIELD =
    /^(snomed_ct|icd10|icd10_pcs|loinc|interpretation_snomed)_(code|codes|term)(_.+)?$/;
const NOT_CODED = new Set(["vitals", "consultation_summary", "suggested_plan"]);
export const PENDING_STALE_MS = 3 * 60 * 1000; // after this, stop waiting

// True while the server is still working on it (and not stuck for minutes)
export const stillFresh = (iso) =>
    !!iso && Date.now() - new Date(iso).getTime() < PENDING_STALE_MS;
export const codesPending = (doc) => stillFresh(doc?.codes_pending_since);
export const planPending = (doc) =>
    doc?.suggested_plan?.status === "generating" &&
    stillFresh(doc.suggested_plan.started_at);

const idOf = (e) =>
    String(
        typeof e === "string"
            ? e
            : (e?.name ??
                  e?.investigation_name ??
                  e?.finding ??
                  e?.relationship ??
                  ""),
    )
        .trim()
        .toLowerCase();
const alreadyCoded = (o) =>
    Object.keys(o).some((k) => {
        const m = k.match(CODE_FIELD);
        if (!m) return false;
        if (m[3] === "_pending" || m[3] === "_status") return !!o[k];
        if (m[3]) return false;
        return Array.isArray(o[k]) ? o[k].some(Boolean) : !!o[k];
    });

// Copies codes from `coded` into `target` (changed in place), matching entries by name
export function mergeCodeFields(target, coded) {
    const walk = (f, c) => {
        if (Array.isArray(f) && Array.isArray(c)) {
            const used = new Set();
            f.forEach((fe, i) => {
                const key = idOf(fe);
                if (!key) return;
                let j = c[i] !== undefined && idOf(c[i]) === key ? i : -1;
                if (j < 0)
                    j = c.findIndex(
                        (ce, k) => !used.has(k) && idOf(ce) === key,
                    );
                if (j < 0) return;
                used.add(j);
                walk(fe, c[j]);
            });
            return;
        }
        if (!f || !c || typeof f !== "object" || typeof c !== "object") return;
        const sameShape =
            !Array.isArray(f.illness) ||
            JSON.stringify(f.illness) === JSON.stringify(c.illness);
        const copy = sameShape && !alreadyCoded(f);
        for (const k of Object.keys(c)) {
            if (CODE_FIELD.test(k)) {
                if (copy) f[k] = c[k];
            } else if (c[k] && typeof c[k] === "object") walk(f[k], c[k]);
        }
    };
    for (const k of Object.keys(coded || {}))
        if (!NOT_CODED.has(k)) walk(target[k], coded[k]);
}

// Takes what the server has now and returns the page's record with the codes and plan added.
// Returns the same object when nothing new has arrived.
export function applyBackground(doc, fresh) {
    if (!fresh) return doc;
    let out = doc;
    if (doc.codes_pending_since && !fresh.codes_pending_since) {
        out = JSON.parse(JSON.stringify(doc));
        mergeCodeFields(out, fresh);
        delete out.codes_pending_since;
    }
    if (
        doc.suggested_plan?.status === "generating" &&
        fresh.suggested_plan?.status !== "generating"
    ) {
        if (out === doc) out = { ...doc };
        if (fresh.suggested_plan) out.suggested_plan = fresh.suggested_plan;
        else delete out.suggested_plan;
    }
    return out;
}
