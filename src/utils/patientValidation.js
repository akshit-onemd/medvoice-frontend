export const TITLES = ["Mr.", "Mrs.", "Ms.", "Miss", "Master", "Dr."];
export const MARITAL = [
    "Single",
    "Married",
    "Divorced",
    "Widowed",
    "Separated",
];
export const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
export const YES_NO = ["Yes", "No"];
export const GENDERS = [
    ["male", "Male"],
    ["female", "Female"],
    ["other", "Other"],
];
export const HISTORY = [
    ["diabetes", "Diabetes mellitus"],
    ["hypertension", "Hypertension"],
    ["hypothyroidism", "Hypothyroidism"],
];
export const HABITS = [
    ["alcohol", "Alcohol"],
    ["tobacco", "Tobacco"],
    ["smoke", "Smoke"],
];

const NAME_RE = /^[\p{L}\p{M}][\p{L}\p{M}\s.'-]*$/u;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PIN_RE = /^\d{6}$/;
const UHID_RE = /^[A-Za-z0-9\-_/]{1,40}$/;

const CORE_TEXT = ["name", "phone", "dob", "gender"];
const EXTRA_TEXT = [
    "title",
    "uhid",
    "marital_status",
    "occupation",
    "alt_phone",
    "email",
    "address",
    "city",
    "pincode",
    "informant_name",
    "channel",
    "tag",
    "referred_by_name",
    "referred_by_phone",
];
const TEXT_KEYS = [...CORE_TEXT, ...EXTRA_TEXT];
const MED_KEYS = [
    "blood_group",
    "diabetes",
    "hypertension",
    "hypothyroidism",
    "alcohol",
    "tobacco",
    "smoke",
];

export function normPhone(s) {
    let t = String(s || "").replace(/[\s\-().]/g, "");
    if (/^\+?91\d{10}$/.test(t)) t = t.replace(/^\+?91/, "");
    else if (/^0\d{10}$/.test(t)) t = t.slice(1);
    return t;
}
const pad = (n) => String(n).padStart(2, "0");
export const todayISO = () => {
    const d = new Date();
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
export const minDobISO = () => {
    const d = new Date();
    return `${d.getFullYear() - 120}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

function monthsSince(dob) {
    const [y, m, d] = dob.split("-").map(Number);
    const now = new Date();
    let months = (now.getFullYear() - y) * 12 + (now.getMonth() + 1 - m);
    if (now.getDate() < d) months--;
    return months;
}

export function ageLabel(dob) {
    if (!dob) return "";
    const months = monthsSince(dob);
    if (months < 0) return "";
    if (months < 12) return `${months} month${months === 1 ? "" : "s"}`;
    const yrs = Math.floor(months / 12);
    return `${yrs} yr${yrs === 1 ? "" : "s"}`;
}

export function formFrom(p = {}) {
    const med = p.medical || {};
    const f = {};
    TEXT_KEYS.forEach((k) => (f[k] = p[k] || ""));
    MED_KEYS.forEach((k) => (f[k] = med[k] || ""));
    f.no_known_history = !!med.no_known_history;
    return f;
}

export const hasExtras = (f) =>
    EXTRA_TEXT.some((k) => f[k]) ||
    MED_KEYS.some((k) => f[k]) ||
    f.no_known_history;

export const EXTRA_ERROR_KEYS = [...EXTRA_TEXT];

export function toPayload(f) {
    const p = {};
    TEXT_KEYS.forEach((k) => (p[k] = String(f[k] ?? "").trim()));
    p.name = p.name.replace(/\s+/g, " ");
    p.phone = normPhone(p.phone);
    p.alt_phone = normPhone(p.alt_phone);
    p.referred_by_phone = normPhone(p.referred_by_phone);
    const medical = {};
    MED_KEYS.forEach((k) => {
        if (f[k]) medical[k] = f[k];
    });
    if (f.no_known_history) {
        medical.no_known_history = true;
        HISTORY.forEach(([k]) => delete medical[k]);
    }
    p.medical = medical;
    return p;
}

const phoneErr = (v, required, final) => {
    if (!v) return required && final ? "Phone number is required" : "";
    if (!final && v.length < 10) return ""; // still typing
    if (/^[6-9]\d{9}$/.test(v)) return "";
    return /^\d{10}$/.test(v)
        ? "Must start with 6, 7, 8 or 9"
        : "Enter a valid 10-digit number";
};

// final=false: while typing. Skips "incomplete" errors.
// final=true: on blur and submit.
export function validateField(k, v, final = true) {
    switch (k) {
        case "name":
            if (!v) return final ? "Name is required" : "";
            if (!NAME_RE.test(v)) return "Enter a valid name";
            return v.length < 2 && final ? "Enter a valid name" : "";
        case "phone":
            return phoneErr(v, true, final);
        case "alt_phone":
        case "referred_by_phone":
            return phoneErr(v, false, final);
        case "dob":
            if (!v) return "";
            if (!/^\d{4}-\d{2}-\d{2}$/.test(v))
                return final ? "Enter a valid date" : "";
            if (v > todayISO()) return "Can't be in the future";
            if (v < minDobISO()) return "Too far in the past";
            return "";
        case "uhid":
            return v && !UHID_RE.test(v) ? "Letters, digits, - _ / only" : "";
        case "email":
            return v && final && !EMAIL_RE.test(v) ? "Enter a valid email" : "";
        case "pincode":
            if (!v) return "";
            if (!/^\d*$/.test(v) || v.length > 6) return "Enter 6 digits";
            return v.length < 6 && final ? "Enter 6 digits" : "";
        default:
            return "";
    }
}

// Top-to-bottom order. First error here gets focus.
export const FIELD_ORDER = [
    "name",
    "phone",
    "dob",
    "uhid",
    "occupation",
    "alt_phone",
    "email",
    "address",
    "city",
    "pincode",
    "informant_name",
    "channel",
    "tag",
    "referred_by_name",
    "referred_by_phone",
];

export function validatePatient(p) {
    const e = {};
    FIELD_ORDER.forEach((k) => {
        const m = validateField(k, p[k] ?? "", true);
        if (m) e[k] = m;
    });
    return e;
}