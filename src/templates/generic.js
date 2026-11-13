// The built-in "General OPD" template (same as the server's templates/builtin/generic.json).
// Used for notes saved before templates existed, and while a note's template is loading.
export const GENERIC_ID = "00000000-0000-4000-8000-000000000001";
const TYPES = [
    "diagnosis",
    "complaints",
    "prescription",
    "followup",
    "vitals",
    "allergies",
    "conditions",
    "medication_history",
    "investigations",
    "procedures",
    "examination",
    "family_history",
    "lifestyle",
    "social_history",
    "other_history",
];
const GENERIC = {
    name: "General OPD",
    specialty: "General Medicine",
    kind: "new",
    sections: TYPES.map((t) => ({ id: t, type: t })),
};
export default GENERIC;
