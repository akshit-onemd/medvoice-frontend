import React, { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Search, Star, X } from "lucide-react";
import {
    getBrandFamilies,
    getBrandPrefs,
    saveBrandPrefs,
    searchBrandMedicines,
} from "../api/processAudio";
import { useDirtyFlag } from "../hooks/useDirty";

const cap = (s) => String(s || "").replace(/\b\w/g, (c) => c.toUpperCase());

export default function BrandSettings() {
    const [prefs, setPrefs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [q, setQ] = useState("");
    const [hits, setHits] = useState([]);
    const [edit, setEdit] = useState(null); // { ing_key, label, families, favs, saved }
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");

    const reload = () =>
        getBrandPrefs()
            .then((d) => setPrefs(d.prefs || []))
            .catch(() => {})
            .finally(() => setLoading(false));
    useEffect(() => {
        reload();
    }, []);

    useEffect(() => {
        const t = q.trim();
        if (t.length < 2) {
            setHits([]);
            return;
        }
        let off = false;
        const h = setTimeout(() => {
            searchBrandMedicines(t)
                .then((d) => !off && setHits(d.results || []))
                .catch(() => {});
        }, 300);
        return () => {
            off = true;
            clearTimeout(h);
        };
    }, [q]);

    const dirty =
        !!edit && JSON.stringify(edit.favs) !== JSON.stringify(edit.saved);
    useDirtyFlag(dirty);

    const openEditor = async (ing_key, label, favs) => {
        setError("");
        try {
            const d = await getBrandFamilies(ing_key);
            setEdit({
                ing_key,
                label: label || d.label || ing_key,
                families: d.families || [],
                favs: [...favs],
                saved: [...favs],
            });
            setQ("");
            setHits([]);
        } catch (e) {
            setError(e.message || "Couldn't load brands");
        }
    };

    const toggle = (fam) =>
        setEdit((e) => ({
            ...e,
            favs: e.favs.includes(fam)
                ? e.favs.filter((x) => x !== fam)
                : [...e.favs, fam].slice(0, 6),
        }));
    const move = (i, d) =>
        setEdit((e) => {
            const j = i + d;
            if (j < 0 || j >= e.favs.length) return e;
            const next = [...e.favs];
            [next[i], next[j]] = [next[j], next[i]];
            return { ...e, favs: next };
        });

    const save = async (ing_key, favs) => {
        setBusy(true);
        setError("");
        try {
            await saveBrandPrefs(ing_key, favs);
            setEdit(null);
            await reload();
        } catch (e) {
            setError(e.message || "Couldn't save");
        } finally {
            setBusy(false);
        }
    };

    const sampleOf = (fam) =>
        edit?.families.find((f) => f.family === fam)?.sample || cap(fam);

    return (
        <div className="mt-8">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted">
                Preferred brands
            </p>
            <p className="mt-1 text-xs text-muted">
                Pick the brands you prescribe for a medicine. The first three
                show in AI suggestions, in this order.
            </p>

            {!loading && prefs.length > 0 && (
                <ul className="mt-3 divide-y divide-line overflow-hidden rounded border border-line">
                    {prefs.map((p) => (
                        <li
                            key={p.ing_key}
                            className="flex items-center gap-3 px-3 py-2.5"
                        >
                            <div className="min-w-0 flex-1">
                                <p className="text-sm text-ink">{p.label}</p>
                                <p className="truncate text-xs text-muted">
                                    {p.families.map(cap).join(", ")}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() =>
                                    openEditor(p.ing_key, p.label, p.families)
                                }
                                className="text-xs text-clinical-600 underline underline-offset-2"
                            >
                                Edit
                            </button>
                            <button
                                type="button"
                                onClick={() => save(p.ing_key, [])}
                                disabled={busy}
                                aria-label={`Remove brands for ${p.label}`}
                                className="text-muted hover:text-ink"
                            >
                                <X size={14} strokeWidth={1.75} />
                            </button>
                        </li>
                    ))}
                </ul>
            )}

            {!edit && (
                <div className="mt-3">
                    <div className="relative">
                        <Search
                            size={14}
                            strokeWidth={1.75}
                            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
                        />
                        <input
                            className="w-full rounded border border-line bg-paper py-2 pl-9 pr-3 text-sm text-ink outline-none focus:border-clinical-500"
                            placeholder="Search a medicine or brand, for example paracetamol or Crocin"
                            value={q}
                            onChange={(e) => setQ(e.target.value)}
                        />
                    </div>
                    {hits.length > 0 && (
                        <ul className="mt-2 divide-y divide-line overflow-hidden rounded border border-line">
                            {hits.map((h) => (
                                <li key={h.ing_key}>
                                    <button
                                        type="button"
                                        onClick={() =>
                                            openEditor(
                                                h.ing_key,
                                                h.label,
                                                prefs.find(
                                                    (p) =>
                                                        p.ing_key === h.ing_key,
                                                )?.families || [],
                                            )
                                        }
                                        className="flex w-full items-center justify-between px-3 py-2.5 text-left text-sm text-ink hover:bg-paper"
                                    >
                                        <span>
                                            {h.label}
                                            {h.matched_brand && (
                                                <span className="ml-2 text-xs text-muted">
                                                    brand: {h.matched_brand}
                                                </span>
                                            )}
                                        </span>
                                        <span className="text-xs text-muted">
                                            {h.brand_count} products
                                        </span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}

            {edit && (
                <div className="mt-3 rounded border border-line bg-paper p-3">
                    <p className="text-sm font-medium text-ink">{edit.label}</p>

                    {edit.favs.length > 0 && (
                        <ol className="mt-2 space-y-1.5">
                            {edit.favs.map((fam, i) => (
                                <li
                                    key={fam}
                                    className="flex items-center gap-2 rounded border border-line bg-surface px-2.5 py-1.5 text-sm"
                                >
                                    <span className="w-4 text-xs text-muted">
                                        {i + 1}
                                    </span>
                                    <span className="flex-1 truncate text-ink">
                                        {sampleOf(fam)}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => move(i, -1)}
                                        disabled={i === 0}
                                        aria-label="Move up"
                                        className="text-muted disabled:opacity-30"
                                    >
                                        <ArrowUp size={14} />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => move(i, 1)}
                                        disabled={i === edit.favs.length - 1}
                                        aria-label="Move down"
                                        className="text-muted disabled:opacity-30"
                                    >
                                        <ArrowDown size={14} />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => toggle(fam)}
                                        aria-label="Remove"
                                        className="text-muted hover:text-ink"
                                    >
                                        <X size={14} />
                                    </button>
                                </li>
                            ))}
                        </ol>
                    )}

                    <p className="mt-3 text-[11px] uppercase tracking-wide text-muted">
                        All brands
                    </p>
                    <ul className="mt-1.5 max-h-60 divide-y divide-line overflow-y-auto rounded border border-line bg-surface">
                        {edit.families.map((f) => (
                            <li key={f.family}>
                                <button
                                    type="button"
                                    onClick={() => toggle(f.family)}
                                    className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-paper"
                                >
                                    <Star
                                        size={14}
                                        strokeWidth={1.75}
                                        className={
                                            edit.favs.includes(f.family)
                                                ? "fill-amber-400 text-amber-500"
                                                : "text-muted"
                                        }
                                    />
                                    <span className="min-w-0 flex-1">
                                        <span className="block truncate text-sm text-ink">
                                            {f.sample}
                                        </span>
                                        <span className="block truncate text-xs text-muted">
                                            {[
                                                f.manufacturer,
                                                f.strengths.join(", "),
                                            ]
                                                .filter(Boolean)
                                                .join(" · ")}
                                        </span>
                                    </span>
                                </button>
                            </li>
                        ))}
                    </ul>

                    {error && (
                        <p className="mt-2 text-sm text-alert-500">{error}</p>
                    )}
                    <div className="mt-3 flex gap-2">
                        <button
                            type="button"
                            onClick={() => save(edit.ing_key, edit.favs)}
                            disabled={busy || !dirty}
                            className="flex-1 rounded bg-clinical-500 py-2 text-sm font-medium text-paper hover:bg-clinical-600 disabled:opacity-40"
                        >
                            {busy ? "Saving…" : "Save"}
                        </button>
                        <button
                            type="button"
                            onClick={() => setEdit(null)}
                            disabled={busy}
                            className="rounded border border-line bg-surface px-4 py-2 text-sm text-ink hover:bg-paper"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}
            {!edit && error && (
                <p className="mt-2 text-sm text-alert-500">{error}</p>
            )}
        </div>
    );
}
