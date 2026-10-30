import React, { useEffect, useRef, useState } from "react";
import { Search, Loader2, Pencil } from "lucide-react";
import { searchBrandProducts } from "../api/processAudio";
import { medLines } from "../utils/brandDisplay";

// Remembers recent searches for the session, so repeating one is instant
const SEARCH_CACHE = new Map();

const inputCls =
    "w-full rounded border border-line bg-paper px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-clinical-500 outline-none";

// Search the medicine database by brand OR generic name.
// onPick({ name: "Metformin 500 mg", brand: "Glycomet 500" })
// keepText: when set, shows "Keep “…” as generic" instead of "Use … as written"
export default function MedicinePicker({
    initialQuery = "",
    autoFocus = false,
    onPick,
    onUseTyped, // (typedText) => void
    keepText = "",
    onKeep, // () => void   (used with keepText)
}) {
    const [q, setQ] = useState(initialQuery);
    const [hits, setHits] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const first = useRef(!!initialQuery.trim());

    useEffect(() => {
        const t = q.trim();
        if (t.length < 2) {
            setHits([]);
            setLoading(false);
            return;
        }
        const key = t.toLowerCase();
        // Seen this search already: show it at once
        if (SEARCH_CACHE.has(key)) {
            setHits(SEARCH_CACHE.get(key));
            setLoading(false);
            setError("");
            return;
        }
        let off = false;
        setLoading(true);
        setError("");
        // The first search (the pre-filled text) goes out at once. Typing waits a moment.
        const wait = first.current ? 0 : 150;
        first.current = false;
        const h = setTimeout(() => {
            searchBrandProducts(t)
                .then((d) => {
                    const r = d.results || [];
                    SEARCH_CACHE.set(key, r);
                    if (SEARCH_CACHE.size > 60)
                        SEARCH_CACHE.delete(SEARCH_CACHE.keys().next().value);
                    if (!off) setHits(r);
                })
                .catch(() => {
                    if (off) return;
                    setHits([]);
                    setError("Search failed. Try again.");
                })
                .finally(() => !off && setLoading(false));
        }, wait);
        return () => {
            off = true;
            clearTimeout(h);
        };
    }, [q]);

    const typed = q.trim();
    return (
        <div>
            <div className="relative">
                <Search
                    size={14}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
                />
                <input
                    className={`${inputCls} pl-8`}
                    placeholder="Search a brand or generic, for example Glycomet or metformin 500"
                    value={q}
                    autoFocus={autoFocus}
                    onChange={(e) => setQ(e.target.value)}
                />
                {loading && (
                    <span className="absolute right-3 top-1/2 -mt-[7px] flex h-[14px] w-[14px] items-center justify-center">
                        <Loader2
                            size={14}
                            className="animate-spin text-muted"
                        />
                    </span>
                )}
            </div>

            {error && <p className="mt-1 text-xs text-alert-500">{error}</p>}

            {hits.length > 0 && (
                <ul className="mt-1 max-h-56 divide-y divide-line overflow-y-auto rounded border border-line bg-surface">
                    {hits.map((h, i) => (
                        <li key={`${h.brand}|${h.generic}|${i}`}>
                            <button
                                type="button"
                                onClick={() =>
                                    onPick?.({
                                        name: h.generic,
                                        brand: h.brand,
                                    })
                                }
                                className="block w-full px-3 py-2 text-left hover:bg-paper"
                            >
                                <span className="block text-sm font-medium text-ink">
                                    {h.brand}
                                </span>
                                <span className="block text-xs text-muted">
                                    {h.generic}
                                    {h.manufacturer
                                        ? ` · ${h.manufacturer}`
                                        : ""}
                                </span>
                            </button>
                        </li>
                    ))}
                </ul>
            )}

            {!loading && !error && typed.length >= 2 && hits.length === 0 && (
                <p className="mt-1 text-xs text-muted">
                    No match in the database.
                </p>
            )}

            {keepText ? (
                <button
                    type="button"
                    onClick={() => onKeep?.()}
                    className="mt-1.5 text-xs text-clinical-600 underline underline-offset-2"
                >
                    Keep “{keepText}” as generic
                </button>
            ) : (
                typed.length >= 2 && (
                    <button
                        type="button"
                        onClick={() => onUseTyped?.(typed)}
                        className="mt-1.5 text-xs text-clinical-600 underline underline-offset-2"
                    >
                        Use “{typed}” as written
                    </button>
                )
            )}
        </div>
    );
}

// The "Medicine" field of the prescription editor: a card with the chosen medicine and a way to search/change it.
// value: { name, brand }, onChange({ name?, brand?, _genericOk? })
export function MedicineField({ value, onChange }) {
    const name = String(value?.name ?? "").trim();
    const brand = String(value?.brand ?? "").trim();
    const empty = !name && !brand;
    const [open, setOpen] = useState(empty);
    const [manual, setManual] = useState(false);
    const { primary, secondary } = medLines(value);
    const needsBrand = !empty && !brand && !value?._genericOk;

    if (open || empty) {
        return (
            <div>
                <span className="mb-1 block text-xs text-muted">Medicine</span>
                <MedicinePicker
                    initialQuery={empty ? "" : name || brand}
                    autoFocus
                    onPick={(p) => {
                        onChange({
                            name: p.name,
                            brand: p.brand,
                            _genericOk: false,
                        });
                        setOpen(false);
                    }}
                    onUseTyped={(t) => {
                        onChange({ name: t, brand: "", _genericOk: true });
                        setOpen(false);
                    }}
                />
                {!empty && (
                    <button
                        type="button"
                        onClick={() => setOpen(false)}
                        className="mt-1 text-xs text-muted underline underline-offset-2"
                    >
                        Cancel
                    </button>
                )}
            </div>
        );
    }

    return (
        <div>
            <span className="mb-1 block text-xs text-muted">Medicine</span>
            <div className="rounded border border-line bg-surface px-3 py-2">
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <p className="text-sm font-medium text-ink">
                            {primary}
                        </p>
                        {secondary && (
                            <p className="text-xs text-muted">{secondary}</p>
                        )}
                    </div>
                    <button
                        type="button"
                        onClick={() => setOpen(true)}
                        className="shrink-0 text-xs text-clinical-600 underline underline-offset-2"
                    >
                        Change
                    </button>
                </div>
                {needsBrand && (
                    <p className="mt-1.5 text-xs text-alert-500">
                        No brand chosen.{" "}
                        <button
                            type="button"
                            onClick={() => setOpen(true)}
                            className="underline underline-offset-2"
                        >
                            Search brands
                        </button>{" "}
                        or{" "}
                        <button
                            type="button"
                            onClick={() => onChange({ _genericOk: true })}
                            className="underline underline-offset-2"
                        >
                            keep generic
                        </button>
                    </p>
                )}
            </div>
            <button
                type="button"
                onClick={() => setManual((v) => !v)}
                className="mt-1 inline-flex items-center gap-1 text-xs text-muted hover:text-ink"
            >
                <Pencil size={11} /> {manual ? "Hide text fields" : "Edit text"}
            </button>
            {manual && (
                <div className="mt-1 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <input
                        className={inputCls}
                        placeholder="Brand"
                        value={brand}
                        onChange={(e) => onChange({ brand: e.target.value })}
                    />
                    <input
                        className={inputCls}
                        placeholder="Generic and strength"
                        value={name}
                        onChange={(e) => onChange({ name: e.target.value })}
                    />
                </div>
            )}
        </div>
    );
}
