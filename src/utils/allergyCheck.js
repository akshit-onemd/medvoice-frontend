const norm = (s) =>
    String(s || "")
        .toLowerCase()
        .replace(/[^a-z0-9 ]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();

const NSAIDS = [
    "ibuprofen",
    "diclofenac",
    "naproxen",
    "ketorolac",
    "aceclofenac",
    "nimesulide",
    "mefenamic",
    "piroxicam",
    "aspirin",
    "brufen",
];
const SULFA = [
    "sulfamethoxazole",
    "cotrimoxazole",
    "co trimoxazole",
    "bactrim",
    "septran",
    "sulfasalazine",
];

// A few well-known families. A short list, not a drug database.
const FAMILIES = {
    penicillin: [
        "amoxicillin",
        "amoxycillin",
        "ampicillin",
        "amoxyclav",
        "augmentin",
        "cloxacillin",
        "flucloxacillin",
        "piperacillin",
        "benzathine",
        "penicillin",
    ],
    sulfa: SULFA,
    sulpha: SULFA,
    nsaid: NSAIDS,
    aspirin: NSAIDS,
};

// Returns the matching recorded allergy name, or null
export function allergyHit(drug, allergies) {
    const d = norm(drug);
    if (!d) return null;
    const tokens = d.split(" ");
    for (const a of allergies || []) {
        const name = String(a?.name || "").trim();
        const n = norm(name);
        if (n.length < 3) continue;
        if (d.includes(n)) return name;
        if (n.split(" ").some((t) => t.length >= 4 && tokens.includes(t)))
            return name;
        for (const [fam, drugs] of Object.entries(FAMILIES)) {
            if (n.includes(fam) && drugs.some((x) => d.includes(x)))
                return name;
        }
    }
    return null;
}
