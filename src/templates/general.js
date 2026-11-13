// The template's own section types (same as the server's templates/general.js).
// Data lives at structured_data.custom[<section id>].
export const GENERAL_TYPES = ["values", "list", "checklist", "choice", "score", "text"];
export const GENERAL_LABELS = {
    values: "Values",
    list: "List",
    checklist: "Checklist",
    choice: "Choice",
    score: "Score",
    text: "Free text",
};
export const STATUS_LABELS = { yes: "Yes", no: "No", not_examined: "Not examined" };

const str = (v) => (v === null || v === undefined ? "" : String(v));
const arr = (v) => (Array.isArray(v) ? v : []);

export const isGeneral = (s) => GENERAL_TYPES.includes(s?.type);

// The value in its proper shape, with every field present
export function shapeOf(s, v) {
    switch (s.type) {
        case "values":
            return Object.fromEntries(arr(s.fields).map((f) => [f.key, str(v?.[f.key])]));
        case "list":
            return arr(v).map((row) =>
                Object.fromEntries(arr(s.fields).map((f) => [f.key, str(row?.[f.key])])),
            );
        case "checklist":
            return arr(s.items).map((item) => {
                const g = arr(v).find((x) => str(x?.item).toLowerCase() === item.toLowerCase()) || {};
                return { item, status: str(g.status), note: str(g.note) };
            });
        case "choice":
            return { selected: arr(v?.selected).filter((o) => arr(s.options).includes(o)) };
        case "score":
            return { value: str(v?.value), note: str(v?.note) };
        default:
            return { text: str(v?.text) };
    }
}

export function isEmptyGeneral(s, v) {
    const d = shapeOf(s, v);
    switch (s.type) {
        case "values":
            return !Object.values(d).some((x) => x.trim());
        case "list":
            return !d.some((row) => Object.values(row).some((x) => x.trim()));
        case "checklist":
            return !d.some((x) => x.status || x.note.trim());
        case "choice":
            return !d.selected.length;
        case "score":
            return !d.value.trim();
        default:
            return !d.text.trim();
    }
}

// Plain lines for the PDF: [{ label, text }]
export function linesOf(s, v) {
    const d = shapeOf(s, v);
    switch (s.type) {
        case "values":
            return arr(s.fields)
                .filter((f) => d[f.key].trim())
                .map((f) => ({ label: f.label, text: `${d[f.key]}${f.unit ? ` ${f.unit}` : ""}` }));
        case "list":
            return d
                .filter((row) => Object.values(row).some((x) => x.trim()))
                .map((row) => ({
                    label: "",
                    text: arr(s.fields)
                        .map((f) => row[f.key] && `${f.label}: ${row[f.key]}`)
                        .filter(Boolean)
                        .join(" · "),
                }));
        case "checklist":
            return d
                .filter((x) => x.status || x.note.trim())
                .map((x) => ({
                    label: x.item,
                    text: [STATUS_LABELS[x.status], x.note].filter(Boolean).join(" — "),
                }));
        case "choice":
            return d.selected.length ? [{ label: "", text: d.selected.join(", ") }] : [];
        case "score":
            return d.value
                ? [{ label: "", text: `${d.value} / ${s.max}${d.note ? ` — ${d.note}` : ""}` }]
                : [];
        default:
            return d.text.trim() ? [{ label: "", text: d.text }] : [];
    }
}
