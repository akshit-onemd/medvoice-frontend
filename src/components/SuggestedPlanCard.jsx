import React, { useEffect, useState } from "react";
import { Sparkles, ChevronDown } from "lucide-react";
import BrandRow from "./BrandRow";
import MedicinePicker from "./MedicineSearch";
import {
    approveSuggestion,
    setSuggestionStatus,
    generateSuggestionFor,
    lookupBrands,
    setBrandFavourite,
} from "../api/processAudio";
import { allergyHit } from "../utils/allergyCheck";

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

const GROUPS = [
    ["medication", "Medications"],
    ["diagnosis", "Diagnosis"],
    ["followup", "Follow up"],
];

// The brand decision for one suggested medicine
function MedChoice({
    it,
    pick,
    info,
    busy,
    searching,
    onDecide,
    onSearch,
    onStar,
}) {
    if (pick) {
        return (
            <p className="pb-2.5 pl-9 pr-3 text-xs text-ink">
                {pick.generic
                    ? `Generic: ${it.name}`
                    : `${pick.brand}${pick.name ? ` · ${pick.name}` : ""}`}
                <button
                    type="button"
                    disabled={busy}
                    onClick={() => onDecide(null)}
                    className="ml-2 text-clinical-600 underline underline-offset-2 disabled:opacity-40"
                >
                    Change
                </button>
            </p>
        );
    }
    return (
        <div className="pb-2.5">
            <p className="pl-9 pr-3 text-xs font-medium text-alert-500">
                Choose a brand for this medicine
            </p>
            <BrandRow
                info={info}
                selected=""
                disabled={busy}
                onSelect={(n) => n && onDecide({ brand: n })}
                onStar={onStar}
            />
            {searching ? (
                <div className="pl-9 pr-3">
                    <MedicinePicker
                        autoFocus
                        initialQuery={it.name}
                        keepText={it.name}
                        onKeep={() => onDecide({ generic: true })}
                        onPick={(p) =>
                            onDecide({ brand: p.brand, name: p.name })
                        }
                    />
                </div>
            ) : (
                <div className="flex gap-3 pl-9 pr-3 pt-1 text-xs">
                    <button
                        type="button"
                        disabled={busy}
                        onClick={onSearch}
                        className="text-clinical-600 underline underline-offset-2 disabled:opacity-40"
                    >
                        Search all medicines
                    </button>
                    <button
                        type="button"
                        disabled={busy}
                        onClick={() => onDecide({ generic: true })}
                        className="text-muted underline underline-offset-2 disabled:opacity-40"
                    >
                        Keep as generic
                    </button>
                </div>
            )}
        </div>
    );
}

export default function SuggestedPlanCard({
    consultationId,
    plan,
    allergies,
    rx,
    canEdit,
    hasTranscript,
    onChange,
}) {
    const [selected, setSelected] = useState(new Set());
    const [busy, setBusy] = useState("");
    const [error, setError] = useState("");
    const [open, setOpen] = useState(false);
    const isAlready = (it) => {
        const list =
            it.kind === "medication"
                ? rx?.medications
                : it.kind === "diagnosis"
                  ? rx?.diagnosis
                  : rx?.followup;
        return (list || []).some((e) =>
            it.kind === "followup"
                ? same(e?.advice, it.advice)
                : same(e?.name, it.name),
        );
    };
    const warnFor = (it) =>
        it.kind === "medication" ? allergyHit(it.name, allergies) : null;

    const planKey = plan?.generated_at || "";
    useEffect(() => {
        if (!plan?.items) return;
        setSelected(
            new Set(
                plan.items
                    .filter((i) => !isAlready(i) && !warnFor(i))
                    .map((i) => i.id),
            ),
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [planKey]);

    const run = async (kind, fn) => {
        setBusy(kind);
        setError("");
        try {
            onChange(await fn());
        } catch (err) {
            setError(err.message || "Something went wrong. Please try again.");
        } finally {
            setBusy("");
        }
    };
    const [brandInfo, setBrandInfo] = useState({});
    // id -> { brand, name } (a brand was chosen) or { generic: true } (kept as written)
    const [brandPick, setBrandPick] = useState({});
    const [searching, setSearching] = useState({});
    const decide = (id, v) => {
        setBrandPick((s) => {
            const n = { ...s };
            if (v) n[id] = v;
            else delete n[id];
            return n;
        });
        setSearching((s) => ({ ...s, [id]: false }));
    };

    useEffect(() => {
        if (!open || plan?.status !== "pending") return;
        const meds = (plan.items || []).filter((i) => i.kind === "medication");
        if (!meds.length) return;
        let cancelled = false;
        lookupBrands(
            meds.map((m) => ({ id: m.id, name: m.name, dosage: m.dosage })),
        )
            .then((d) => {
                if (!cancelled)
                    setBrandInfo(
                        Object.fromEntries(
                            (d.results || []).map((r) => [r.id, r]),
                        ),
                    );
            })
            .catch(() => {});
        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, planKey]);

    const star = async (item, b) => {
        const info = brandInfo[item.id];
        if (!info?.ingKey) return;
        try {
            await setBrandFavourite(info.ingKey, b.family, !b.favourite);
            const d = await lookupBrands([
                { id: item.id, name: item.name, dosage: item.dosage },
            ]);
            setBrandInfo((s) => ({
                ...s,
                [item.id]: d.results?.[0] || s[item.id],
            }));
        } catch {
            /* the star is a convenience. Ignore a failure. */
        }
    };

    // ---- no suggestion yet ----
    if (!plan) {
        if (!canEdit || !hasTranscript) return null;
        return (
            <div className="mb-5">
                <button
                    type="button"
                    onClick={() =>
                        run("generate", () =>
                            generateSuggestionFor(consultationId),
                        )
                    }
                    disabled={!!busy}
                    className="inline-flex items-center gap-2 rounded border border-dashed border-clinical-500 bg-surface px-4 py-2.5 text-sm text-clinical-600 hover:bg-clinical-50 disabled:opacity-40"
                >
                    <Sparkles size={16} strokeWidth={1.75} />
                    {busy === "generate"
                        ? "Thinking…"
                        : "Suggest a treatment plan"}
                </button>
                {error && (
                    <p className="mt-2 text-sm text-alert-500">{error}</p>
                )}
            </div>
        );
    }

    if (plan.status === "approved") {
        return (
            <div className="mb-5 flex items-center gap-2 rounded-md border border-line bg-surface px-5 py-3 text-sm text-muted shadow-panel">
                <Sparkles
                    size={14}
                    strokeWidth={1.75}
                    className="text-clinical-600"
                />
                AI-suggested items were added to the prescription.
            </div>
        );
    }

    if (plan.status === "dismissed") {
        return (
            <div className="mb-5 flex items-center gap-3 rounded-md border border-line bg-surface px-5 py-3 text-sm text-muted shadow-panel">
                <span className="flex-1">AI suggestion hidden.</span>
                <button
                    type="button"
                    onClick={() =>
                        run("show", () =>
                            setSuggestionStatus(consultationId, "pending"),
                        )
                    }
                    disabled={!!busy}
                    className="text-clinical-600 underline underline-offset-2 disabled:opacity-40"
                >
                    Show
                </button>
            </div>
        );
    }

    // ---- pending ----
    const items = plan.items || [];
    const chosen = items.filter((i) => selected.has(i.id) && !isAlready(i));

    const toggle = (id) =>
        setSelected((s) => {
            const n = new Set(s);
            if (n.has(id)) n.delete(id);
            else n.add(id);
            return n;
        });

    const needsBrand = (i) =>
        i.kind === "medication" && !isAlready(i) && !brandPick[i.id];
    const unresolved = chosen.filter(needsBrand);

    const approve = () => {
        if (!chosen.length || unresolved.length) return;
        const warned = chosen.filter((i) => warnFor(i));
        if (
            warned.length &&
            !window.confirm(
                `${warned.map((i) => i.name).join(", ")} may conflict with a recorded allergy. Add anyway?`,
            )
        ) {
            return;
        }
        const picked = Object.fromEntries(
            chosen
                .filter((i) => brandPick[i.id] && !brandPick[i.id].generic)
                .map((i) => [i.id, brandPick[i.id]]),
        );
        run("approve", () =>
            approveSuggestion(
                consultationId,
                chosen.map((i) => i.id),
                picked,
            ),
        );
    };

    const detailOf = (it) => {
        if (it.kind === "medication") {
            const dose = Array.isArray(it.dosage)
                ? it.dosage.join(", ")
                : it.dosage;
            return [dose, it.duration].filter(Boolean).join(" · ");
        }
        if (it.kind === "followup") return it.advice;
        return "";
    };

    return (
        <div className="mb-5 rounded-md border border-dashed border-clinical-500 bg-surface shadow-panel">
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                aria-expanded={open}
                className={`flex w-full items-center gap-2 px-5 py-3.5 text-left ${
                    open ? "border-b border-line" : ""
                }`}
            >
                <Sparkles
                    size={16}
                    strokeWidth={1.75}
                    className="shrink-0 text-clinical-600"
                />
                <h3 className="flex-1 font-serif text-lg text-ink">
                    AI suggested plan
                </h3>
                {open && (
                    <span className="rounded-full border border-clinical-500 bg-clinical-50 px-2 py-0.5 text-[11px] text-clinical-600">
                        Suggestion
                    </span>
                )}
                <span className="inline-flex shrink-0 items-center gap-1 text-xs text-clinical-600">
                    {open ? "Show less" : "Show more"}
                    <ChevronDown
                        size={12}
                        className={`transition-transform ${open ? "rotate-180" : ""}`}
                    />
                </span>
            </button>

            {open && (
                <div className="px-5 py-4">
                    <p className="text-xs text-muted">
                        Review before use. Only ticked items are added to the
                        prescription.
                    </p>
                    {plan.note && (
                        <p className="mt-2 text-sm text-ink">{plan.note}</p>
                    )}

                    {GROUPS.map(([kind, title]) => {
                        const rows = items.filter((i) => i.kind === kind);
                        if (!rows.length) return null;
                        return (
                            <div key={kind} className="mt-4">
                                <p className="text-[11px] font-medium uppercase tracking-wide text-muted">
                                    {title}
                                </p>
                                <ul className="mt-1.5 divide-y divide-line overflow-hidden rounded border border-line">
                                    {rows.map((it) => {
                                        const already = isAlready(it);
                                        const warn = warnFor(it);
                                        const detail = detailOf(it);
                                        return (
                                            <li key={it.id}>
                                                <label
                                                    className={`flex items-start gap-3 px-3 py-2.5 ${
                                                        already
                                                            ? "opacity-60"
                                                            : "cursor-pointer hover:bg-paper"
                                                    }`}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        className="mt-1"
                                                        checked={
                                                            selected.has(
                                                                it.id,
                                                            ) && !already
                                                        }
                                                        disabled={
                                                            already || !!busy
                                                        }
                                                        onChange={() =>
                                                            toggle(it.id)
                                                        }
                                                    />
                                                    <div className="min-w-0 flex-1">
                                                        <p className="text-sm text-ink">
                                                            {it.name}
                                                            {already && (
                                                                <span className="ml-2 rounded-full border border-line bg-paper px-1.5 py-0.5 text-[10px] text-muted">
                                                                    Already
                                                                    prescribed
                                                                </span>
                                                            )}
                                                        </p>
                                                        {detail && (
                                                            <p className="text-xs text-muted">
                                                                {detail}
                                                            </p>
                                                        )}
                                                        {it.kind ===
                                                            "medication" &&
                                                            it.instructions && (
                                                                <p className="text-xs text-muted">
                                                                    {
                                                                        it.instructions
                                                                    }
                                                                </p>
                                                            )}
                                                        {it.rationale && (
                                                            <p className="mt-0.5 text-xs italic text-muted">
                                                                {it.rationale}
                                                            </p>
                                                        )}
                                                        {warn && (
                                                            <p className="mt-0.5 text-xs font-medium text-alert-500">
                                                                Check allergy:
                                                                {warn}
                                                            </p>
                                                        )}
                                                    </div>
                                                </label>
                                                {it.kind === "medication" &&
                                                    !already &&
                                                    selected.has(it.id) && (
                                                        <MedChoice
                                                            it={it}
                                                            pick={
                                                                brandPick[it.id]
                                                            }
                                                            info={
                                                                brandInfo[it.id]
                                                            }
                                                            busy={!!busy}
                                                            searching={
                                                                !!searching[
                                                                    it.id
                                                                ]
                                                            }
                                                            onDecide={(v) =>
                                                                decide(it.id, v)
                                                            }
                                                            onSearch={() =>
                                                                setSearching(
                                                                    (s) => ({
                                                                        ...s,
                                                                        [it.id]: true,
                                                                    }),
                                                                )
                                                            }
                                                            onStar={(b2) =>
                                                                star(it, b2)
                                                            }
                                                        />
                                                    )}
                                            </li>
                                        );
                                    })}
                                </ul>
                            </div>
                        );
                    })}

                    {error && (
                        <p className="mt-3 text-sm text-alert-500">{error}</p>
                    )}

                    <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                        <button
                            type="button"
                            onClick={approve}
                            disabled={
                                !chosen.length ||
                                !!busy ||
                                unresolved.length > 0
                            }
                            className="flex-1 rounded bg-clinical-500 py-2.5 text-sm font-medium text-paper hover:bg-clinical-600 disabled:opacity-40"
                        >
                            {busy === "approve"
                                ? "Adding…"
                                : unresolved.length
                                  ? `Choose a brand for ${unresolved.length} medicine${unresolved.length > 1 ? "s" : ""}`
                                  : chosen.length
                                    ? `Add ${chosen.length} selected to prescription`
                                    : "Tick items to add"}
                        </button>
                        <button
                            type="button"
                            onClick={() =>
                                run("dismiss", () =>
                                    setSuggestionStatus(
                                        consultationId,
                                        "dismissed",
                                    ),
                                )
                            }
                            disabled={!!busy}
                            className="rounded border border-line bg-surface px-5 py-2.5 text-sm text-ink hover:bg-paper disabled:opacity-40"
                        >
                            Dismiss
                        </button>
                    </div>
                    <p className="mt-3 text-[11px] text-muted">
                        AI suggestions can be wrong. Allergy checks match names
                        and a few common drug families only. Check every item.
                    </p>
                </div>
            )}
        </div>
    );
}
