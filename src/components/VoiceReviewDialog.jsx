import React, { useEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import { applyVoiceRows } from "../api/processAudio";
import { useDirtyFlag } from "../hooks/useDirty";

const arr = (v) => (Array.isArray(v) ? v : []);
const dash = (parts) => parts.filter(Boolean).join(" · ");
const norm = (s) =>
    String(s || "")
        .toLowerCase()
        .replace(/[^a-z0-9 ]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
const same = (a, b) => {
    const x = norm(a);
    const y = norm(b);
    if (!x || !y) return false;
    return (
        x === y ||
        (x.length >= 4 && y.length >= 4 && (x.includes(y) || y.includes(x)))
    );
};
const getPath = (o, path) => path.split(".").reduce((x, k) => x?.[k], o);
const pushPath = (obj, path, row) => {
    const ks = path.split(".");
    const last = ks.pop();
    ks.reduce((o, k) => o[k], obj)[last].push(row);
};

const EMPTY = () => ({
    vitals: [],
    allergies: [],
    conditions: [],
    medication_history: [],
    investigation_history: [],
    procedures: [],
    system_review: [],
    family_history: [],
    lifestyle_habits: [],
    social_history: [],
    other_history: [],
    prescription: {
        symptoms: [],
        medications: [],
        diagnosis: [],
        followup: [],
    },
});

const named = (path, label, detail = () => "") => ({
    path,
    label,
    key: (r) => r.name,
    title: (r) => r.name,
    detail,
});

// Order matches the page: prescription first, then history
const META = [
    named("prescription.symptoms", "Symptoms / complaints", (r) =>
        dash([r.duration, r.notes]),
    ),
    named("prescription.medications", "Medications prescribed", (r) =>
        dash([arr(r.dosage).join(", "), r.duration, r.instructions]),
    ),
    named("prescription.diagnosis", "Diagnosis"),
    {
        path: "prescription.followup",
        label: "Follow up",
        key: (r) => r.advice || r.next_visit_duration || r.date,
        title: (r) => r.next_visit_duration || r.date || "Follow up",
        detail: (r) =>
            dash([r.next_visit_duration && r.date ? r.date : "", r.advice]),
    },
    named("vitals", "Vitals", (r) => r.value),
    named("allergies", "Allergies", (r) => r.notes),
    named("conditions", "Conditions", (r) => dash([r.duration, r.notes])),
    named("medication_history", "Medicines already taken", (r) =>
        dash([r.dosage, r.duration, r.status, arr(r.instruction).join(", ")]),
    ),
    {
        path: "investigation_history",
        label: "Investigations",
        key: (r) => r.name || arr(r.readings)[0]?.investigation_name,
        title: (r) => r.name || "Results",
        detail: (r) =>
            arr(r.readings)
                .map((x) =>
                    `${x.investigation_name} ${dash([x.result, x.unit]).replace(" · ", " ")}`.trim(),
                )
                .join("; "),
    },
    named("procedures", "Procedures", (r) => dash([r.date, r.notes])),
    {
        path: "system_review",
        label: "System review",
        key: (r) => r.name,
        title: (r) => r.name || "Findings",
        detail: (r) => dash([arr(r.findings).join(", "), r.notes]),
    },
    {
        path: "family_history",
        label: "Family history",
        key: (r) => r.relationship,
        title: (r) => r.relationship || "Relative",
        detail: (r) => dash([arr(r.illness).join(", "), r.notes]),
    },
    named("lifestyle_habits", "Lifestyle", (r) =>
        dash([r.frequency, r.duration, r.notes]),
    ),
    named("social_history", "Social history", (r) => r.notes),
    named("other_history", "Other history", (r) => r.notes),
];

export default function VoiceReviewDialog({
    consultationId,
    result,
    doc,
    editorOpen,
    onApplied,
    onClose,
}) {
    useDirtyFlag(true); // Back warns while this is open
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [showAll, setShowAll] = useState(false);
    const panelRef = useRef(null);

    // New rows
    const items = useMemo(() => {
        const out = [];
        for (const m of META) {
            const existing = arr(getPath(doc, m.path));
            arr(getPath(result.rows, m.path)).forEach((row, i) => {
                let tag = "";
                if (existing.some((e) => same(m.key(e), m.key(row))))
                    tag = "Already in record";
                out.push({ id: `${m.path}:${i}`, m, row, tag });
            });
        }
        return out;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [result]);

    // Changes to values already in the record
    const edits = result.edits || [];

    const [selected, setSelected] = useState(
        () => new Set(items.filter((i) => !i.tag).map((i) => i.id)),
    );
    const [editSel, setEditSel] = useState(
        () => new Set(edits.map((_, i) => i)),
    );
    const chosen = items.filter((i) => selected.has(i.id));
    const total = chosen.length + editSel.size;

    useEffect(() => {
        const prev = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        panelRef.current?.focus();
        return () => {
            document.body.style.overflow = prev;
        };
    }, []);

    useEffect(() => {
        const onKey = (e) => {
            if (e.key === "Escape" && !busy) onClose();
        };
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [busy, onClose]);

    const toggle = (id) =>
        setSelected((s) => {
            const n = new Set(s);
            if (n.has(id)) n.delete(id);
            else n.add(id);
            return n;
        });
    const toggleEdit = (i) =>
        setEditSel((s) => {
            const n = new Set(s);
            if (n.has(i)) n.delete(i);
            else n.add(i);
            return n;
        });

    const apply = async () => {
        const payload = EMPTY();
        items.forEach(
            (it) => selected.has(it.id) && pushPath(payload, it.m.path, it.row),
        );
        const sent = edits
            .filter((_, i) => editSel.has(i))
            .map((e) => ({
                id: e.id,
                field: e.field,
                value: e.value,
                old: e.old,
            }));
        setBusy(true);
        setError("");
        try {
            onApplied(await applyVoiceRows(consultationId, payload, sent));
            onClose();
        } catch (err) {
            setError(
                err.message || "Couldn't update the record. Please try again.",
            );
            setBusy(false);
        }
    };

    const heard = result.heard || "";
    const longHeard = heard.length > 140;
    const nothing = items.length === 0 && edits.length === 0;

    return (
        <div
            className="fixed inset-0 z-[60] flex items-end justify-center bg-ink/50 sm:items-center sm:p-4"
            onMouseDown={(e) => {
                if (e.target === e.currentTarget && !busy) onClose();
            }}
        >
            <div
                ref={panelRef}
                tabIndex={-1}
                role="dialog"
                aria-modal="true"
                aria-labelledby="voice-review-title"
                className="flex w-full flex-col overflow-hidden rounded-t-lg border border-line bg-surface shadow-panel outline-none sm:max-w-lg sm:rounded-md"
                style={{ height: "min(85vh, 680px)", maxHeight: "85dvh" }}
            >
                <div className="flex shrink-0 items-start justify-between gap-3 px-5 pb-3 pt-5">
                    <div>
                        <h2
                            id="voice-review-title"
                            className="font-serif text-lg text-ink"
                        >
                            Review what was heard
                        </h2>
                        <p className="text-xs text-muted">
                            Only ticked rows are applied. Edit them afterwards
                            with the pencil.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={busy}
                        aria-label="Close"
                        className="shrink-0 text-muted hover:text-ink disabled:opacity-40"
                    >
                        <X size={18} strokeWidth={1.75} />
                    </button>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto px-5">
                    <div className="rounded border border-line bg-paper px-3 py-2.5 text-sm">
                        {heard ? (
                            <>
                                <p
                                    className={`text-ink/80 ${
                                        showAll
                                            ? "max-h-40 overflow-y-auto"
                                            : "max-h-14 overflow-hidden"
                                    }`}
                                >
                                    Heard: “{heard}”
                                </p>
                                {longHeard && (
                                    <button
                                        type="button"
                                        onClick={() => setShowAll((v) => !v)}
                                        className="mt-1 text-xs text-clinical-600 underline underline-offset-2"
                                    >
                                        {showAll ? "Show less" : "Show all"}
                                    </button>
                                )}
                            </>
                        ) : (
                            <p className="text-muted">Nothing was heard.</p>
                        )}
                    </div>

                    {nothing ? (
                        <p className="py-6 text-center text-sm text-muted">
                            Nothing to add or change. Try again, speaking
                            clearly and naming each item.
                        </p>
                    ) : (
                        <>
                            {edits.length > 0 && (
                                <div className="mt-4">
                                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted">
                                        Changes to existing values
                                    </p>
                                    <ul className="mt-1.5 divide-y divide-line overflow-hidden rounded border border-line">
                                        {edits.map((e, i) => (
                                            <li key={`${e.id}|${e.field}`}>
                                                <label className="flex cursor-pointer items-start gap-3 px-3 py-2.5 hover:bg-paper">
                                                    <input
                                                        type="checkbox"
                                                        className="mt-1"
                                                        checked={editSel.has(i)}
                                                        disabled={busy}
                                                        onChange={() =>
                                                            toggleEdit(i)
                                                        }
                                                    />
                                                    <div className="min-w-0 flex-1">
                                                        <p className="text-sm text-ink">
                                                            {e.title ||
                                                                e.section}
                                                            <span className="ml-2 rounded-full border border-line bg-paper px-1.5 py-0.5 text-[10px] text-muted">
                                                                {e.label ===
                                                                "Value"
                                                                    ? e.section
                                                                    : `${e.section} · ${e.label}`}
                                                            </span>
                                                        </p>
                                                        <p className="mt-0.5 text-sm">
                                                            {e.old ? (
                                                                <span className="text-muted line-through">
                                                                    {e.old}
                                                                </span>
                                                            ) : (
                                                                <span className="italic text-muted">
                                                                    empty
                                                                </span>
                                                            )}
                                                            <span className="mx-1.5 text-muted">
                                                                →
                                                            </span>
                                                            <span className="font-medium text-ink">
                                                                {e.new}
                                                            </span>
                                                        </p>
                                                    </div>
                                                </label>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {META.map((m) => {
                                const rows = items.filter((i) => i.m === m);
                                if (!rows.length) return null;
                                return (
                                    <div key={m.path} className="mt-4">
                                        <p className="text-[11px] font-medium uppercase tracking-wide text-muted">
                                            {m.label}
                                        </p>
                                        <ul className="mt-1.5 divide-y divide-line overflow-hidden rounded border border-line">
                                            {rows.map((it) => {
                                                const detail = m.detail(it.row);
                                                return (
                                                    <li key={it.id}>
                                                        <label className="flex cursor-pointer items-start gap-3 px-3 py-2.5 hover:bg-paper">
                                                            <input
                                                                type="checkbox"
                                                                className="mt-1"
                                                                checked={selected.has(
                                                                    it.id,
                                                                )}
                                                                disabled={busy}
                                                                onChange={() =>
                                                                    toggle(
                                                                        it.id,
                                                                    )
                                                                }
                                                            />
                                                            <div className="min-w-0 flex-1">
                                                                <p className="text-sm text-ink">
                                                                    {m.title(
                                                                        it.row,
                                                                    )}
                                                                    {it.tag && (
                                                                        <span className="ml-2 rounded-full border border-line bg-paper px-1.5 py-0.5 text-[10px] text-muted">
                                                                            {
                                                                                it.tag
                                                                            }
                                                                        </span>
                                                                    )}
                                                                </p>
                                                                {detail && (
                                                                    <p className="text-xs text-muted">
                                                                        {detail}
                                                                    </p>
                                                                )}
                                                            </div>
                                                        </label>
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                    </div>
                                );
                            })}
                        </>
                    )}
                    <div className="h-4" />
                </div>

                <div
                    className="shrink-0 border-t border-line px-5 pt-3"
                    style={{
                        paddingBottom:
                            "max(1.25rem, env(safe-area-inset-bottom))",
                    }}
                >
                    {editorOpen && (
                        <p className="mb-2 text-xs text-alert-500">
                            A section editor is open. Applying will close it and
                            drop its unsaved changes.
                        </p>
                    )}
                    {error && (
                        <p className="mb-2 text-sm text-alert-500">{error}</p>
                    )}
                    <div className="flex flex-col gap-2 sm:flex-row">
                        <button
                            type="button"
                            onClick={apply}
                            disabled={!total || busy}
                            className="flex-1 rounded bg-clinical-500 py-2.5 text-sm font-medium text-paper hover:bg-clinical-600 disabled:opacity-40"
                        >
                            {busy
                                ? "Applying…"
                                : total
                                  ? `Apply ${total} to record`
                                  : "Tick rows to apply"}
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={busy}
                            className="rounded border border-line bg-surface px-5 py-2.5 text-sm text-ink hover:bg-paper disabled:opacity-40"
                        >
                            Discard
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
