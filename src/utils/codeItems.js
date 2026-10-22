export const VOCAB_LABEL = {
    snomed: "SNOMED CT",
    icd10: "ICD-10",
    rxnorm: "RxNorm",
    loinc: "LOINC",
};

// Maps a card's tag label to a vocabulary
export function vocabOfSystem(system) {
    const x = String(system || "").toLowerCase();
    if (x.includes("snomed")) return "snomed";
    if (x.includes("pcs")) return null;
    if (x.includes("icd")) return "icd10";
    if (x.includes("rx")) return "rxnorm";
    if (x.includes("loinc") || x.includes("lnc")) return "loinc";
    return null;
}

const arr = (v) => (Array.isArray(v) ? v : []);
const at = (o, p) => p.split(".").reduce((x, k) => x?.[k], o);

const SPEC = [
    [
        "allergies",
        "Allergy",
        [
            ["snomed_ct_code", "snomed"],
            ["icd10_code", "icd10"],
        ],
    ],
    [
        "conditions",
        "Condition",
        [
            ["snomed_ct_code", "snomed"],
            ["icd10_code", "icd10"],
        ],
    ],
    ["procedures", "Procedure", [["snomed_ct_code", "snomed"]]],
    ["lifestyle_habits", "Lifestyle", [["snomed_ct_code", "snomed"]]],
    ["social_history", "Social history", [["snomed_ct_code", "snomed"]]],
    ["medication_history", "Medicine taken", [["rxnorm_code", "rxnorm"]]],
    ["prescription.symptoms", "Symptom", [["snomed_ct_code", "snomed"]]],
    ["prescription.medications", "Prescribed", [["rxnorm_code", "rxnorm"]]],
    [
        "prescription.diagnosis",
        "Diagnosis",
        [
            ["snomed_ct_code", "snomed"],
            ["icd10_code", "icd10"],
        ],
    ],
];

// Every coded field in the record, with where it lives
export function collectCodeItems(doc) {
    const items = [];
    const put = (path, key, vocab, label, term, e) => {
        const status = e?.[`${key}_status`];
        if (!term || !status) return; // older records carry no status
        items.push({
            id: [...path, key].join("."),
            path: [...path, key],
            vocab,
            label,
            term,
            status,
            code: e[key] || "",
            codeTerm: e[`${key}_umls_term`] || "",
            alts: arr(e[`${key}_alts`]),
        });
    };
    const putIdx = (path, key, idx, vocab, label, term, e) => {
        const status = arr(e?.[`${key}_status`])[idx];
        if (!term || !status) return;
        items.push({
            id: [...path, key, idx].join("."),
            path: [...path, key, idx],
            vocab,
            label,
            term,
            status,
            code: arr(e[key])[idx] || "",
            codeTerm: arr(e[`${key}_terms`])[idx] || "",
            alts: arr(arr(e[`${key}_alts`])[idx]),
        });
    };

    for (const [p, label, fields] of SPEC) {
        arr(at(doc, p)).forEach((e, i) =>
            fields.forEach(([key, vocab]) =>
                put([...p.split("."), i], key, vocab, label, e?.name, e),
            ),
        );
    }
    arr(doc.investigation_history).forEach((inv, i) =>
        arr(inv?.readings).forEach((r, j) => {
            const path = ["investigation_history", i, "readings", j];
            put(path, "loinc_code", "loinc", "Test", r?.investigation_name, r);
            put(
                path,
                "interpretation_snomed_code",
                "snomed",
                "Result",
                r?.interpretation,
                r,
            );
        }),
    );
    arr(doc.system_review).forEach((e, i) =>
        arr(e?.findings).forEach((f, j) =>
            put(
                ["system_review", i, "findings", j],
                "snomed_ct_code",
                "snomed",
                "Finding",
                f?.finding,
                f,
            ),
        ),
    );
    arr(doc.family_history).forEach((e, i) =>
        arr(e?.illness).forEach((ill, k) => {
            const label = `Family: ${e?.relationship || "relative"}`;
            putIdx(
                ["family_history", i],
                "snomed_ct_codes",
                k,
                "snomed",
                label,
                ill,
                e,
            );
            putIdx(
                ["family_history", i],
                "icd10_codes",
                k,
                "icd10",
                label,
                ill,
                e,
            );
        }),
    );
    return items;
}
