// The clinical section types (same list as the server's templates/sectionTypes.js).
// rx: shown inside the Prescription & Plan card; key: where the data lives in the record.
export const SECTION_TYPES = {
    diagnosis: { rx: true, key: "prescription.diagnosis", title: "Diagnosis" },
    complaints: { rx: true, key: "prescription.symptoms", title: "Presenting symptoms" },
    prescription: { rx: true, key: "prescription.medications", title: "Prescribed today" },
    followup: { rx: true, key: "prescription.followup", title: "Follow-up" },
    vitals: { key: "vitals", title: "Vitals" },
    allergies: { key: "allergies", title: "Allergies" },
    conditions: { key: "conditions", title: "Conditions" },
    medication_history: { key: "medication_history", title: "Medication History" },
    investigations: { key: "investigation_history", title: "Investigations" },
    procedures: { key: "procedures", title: "Procedures" },
    examination: { key: "system_review", title: "Review of Systems" },
    family_history: { key: "family_history", title: "Family History" },
    lifestyle: { key: "lifestyle_habits", title: "Lifestyle Habits" },
    social_history: { key: "social_history", title: "Social History" },
    other_history: { key: "other_history", title: "Other Notes" },
};
