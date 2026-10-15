import React, { useMemo, useRef, useState } from "react";
import { Minus, Plus, PlusCircle, Search, X } from "lucide-react";
import { money, lineAmounts, bundleAmounts, r2 } from "../utils/money";

const keyOf = (v) =>
    v.adhoc ? v.id : v.bundle_id ? `b:${v.bundle_id}` : v.service_id;
let tmpN = 0;
const tmpId = () => `tmp-${Date.now()}-${++tmpN}`; // server swaps in a real id on save

const NUM = /^\d+(\.\d{1,2})?$/;
const fieldCls =
    "w-full rounded border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-muted outline-none focus:border-clinical-500";
const BLANK = { name: "", description: "", fee: "", qty: "1", tax_id: "" };

export default function ServicePicker({
    catalog,
    bundles = [],
    taxes,
    value,
    onChange,
    disabled = false,
    allowAdhoc = false,
    bundleMode = false,
    emptyHint = "No services yet.",
}) {
    const [query, setQuery] = useState("");
    const [open, setOpen] = useState(false);
    const [active, setActive] = useState(0);
    const [adhocOpen, setAdhocOpen] = useState(false);
    const [ad, setAd] = useState(BLANK);
    const [adErr, setAdErr] = useState({});
    const inputRef = useRef(null);

    const byId = useMemo(
        () => Object.fromEntries(catalog.map((s) => [s.id, s])),
        [catalog],
    );
    const bundleById = useMemo(
        () => Object.fromEntries(bundles.map((b) => [b.id, b])),
        [bundles],
    );
    const taxById = useMemo(
        () => Object.fromEntries(taxes.map((t) => [t.id, t])),
        [taxes],
    );

    // Services and bundles in one searchable list
    const available = useMemo(() => {
        const svc = catalog
            .filter(
                (s) => s.active && !value.some((v) => v.service_id === s.id),
            )
            .map((s) => ({ kind: "service", id: s.id, s }));
        const bun = bundles
            .filter(
                (b) =>
                    b.active &&
                    b.items.length &&
                    !value.some((v) => v.bundle_id === b.id),
            )
            .map((b) => ({ kind: "bundle", id: b.id, b }));
        return [...bun, ...svc];
    }, [catalog, bundles, value]);

    const matches = useMemo(() => {
        const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
        if (tokens.length === 0) return available;
        const scored = [];
        for (const r of available) {
            const src = r.kind === "bundle" ? r.b : r.s;
            const name = src.name.toLowerCase();
            const extra =
                r.kind === "bundle"
                    ? r.b.items.map((m) => m.name.toLowerCase()).join(" ")
                    : "";
            const hay = `${name} ${(src.description || "").toLowerCase()} ${extra}`;
            if (!tokens.every((t) => hay.includes(t))) continue;
            const rank = name.startsWith(tokens[0])
                ? 0
                : name.includes(tokens[0])
                  ? 1
                  : 2;
            scored.push({ r, rank });
        }
        return scored.sort((a, b) => a.rank - b.rank).map((x) => x.r);
    }, [available, query]);

    const rows = value
        .map((v) => {
            if (v.adhoc) {
                return {
                    v,
                    kind: "adhoc",
                    s: {
                        id: v.id,
                        name: v.name,
                        description: v.description,
                        fee: Number(v.fee),
                        tax_id: v.tax_id,
                    },
                };
            }
            if (v.bundle_id) {
                const b = bundleById[v.bundle_id];
                return b ? { v, kind: "bundle", b } : null;
            }
            const s = byId[v.service_id];
            return s ? { v, kind: "service", s } : null;
        })
        .filter(Boolean);

    const add = (r) => {
        onChange([
            ...value,
            r.kind === "bundle"
                ? { bundle_id: r.id, qty: 1, mode: "named" }
                : { service_id: r.id, qty: 1 },
        ]);
        setQuery("");
        setActive(0);
        inputRef.current?.focus();
    };
    const setQty = (key, qty) =>
        onChange(
            value.map((v) =>
                keyOf(v) === key
                    ? { ...v, qty: Math.min(99, Math.max(1, qty)) }
                    : v,
            ),
        );
    const setMode = (key, mode) =>
        onChange(value.map((v) => (keyOf(v) === key ? { ...v, mode } : v)));
    const remove = (key) => onChange(value.filter((v) => keyOf(v) !== key));

    const addAdhoc = () => {
        const errs = {};
        const name = ad.name.trim().replace(/\s+/g, " ");
        if (name.length < 2) errs.name = "Enter a name";
        const feeOk = NUM.test(ad.fee.trim());
        const fee = feeOk ? Number(ad.fee.trim()) : 0;
        if (!feeOk || fee <= 0 || fee > 10000000)
            errs.fee = "Price above 0, up to 2 decimals";
        const qty = /^\d+$/.test(ad.qty.trim()) ? Number(ad.qty.trim()) : 0;
        if (qty < 1 || qty > 99) errs.qty = "1 to 99";
        setAdErr(errs);
        if (Object.keys(errs).length) return;
        onChange([
            ...value,
            {
                adhoc: true,
                id: tmpId(),
                name,
                description: ad.description.trim(),
                fee,
                qty,
                tax_id: ad.tax_id || null,
            },
        ]);
        setAd(BLANK);
        setAdErr({});
        setAdhocOpen(false);
    };

    const onKeyDown = (e) => {
        if (e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
            setActive((i) => Math.min(i + 1, Math.max(matches.length - 1, 0)));
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((i) => Math.max(i - 1, 0));
        } else if (e.key === "Enter") {
            e.preventDefault();
            if (open && matches[active]) add(matches[active]);
        } else if (e.key === "Escape" && open) {
            e.stopPropagation(); // close the list, not the dialog
            setOpen(false);
        }
    };

    const amountsOf = (r) =>
        r.kind === "bundle"
            ? bundleAmounts(r.b, r.v.qty, taxById)
            : lineAmounts(r.s.fee, r.v.qty, taxById[r.s.tax_id]?.rate);

    let sub = 0;
    let taxSum = 0;
    rows.forEach((r) => {
        const a = amountsOf(r);
        sub += a.base;
        taxSum += a.tax;
    });

    if (catalog.length === 0 && bundles.length === 0 && !allowAdhoc) {
        return <p className="text-sm text-muted">{emptyHint}</p>;
    }

    return (
        <div>
            <div className="relative">
                <Search
                    size={14}
                    strokeWidth={1.75}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
                />
                <input
                    ref={inputRef}
                    type="text"
                    role="combobox"
                    aria-expanded={open}
                    aria-controls="service-results"
                    autoComplete="off"
                    value={query}
                    disabled={disabled || available.length === 0}
                    placeholder={
                        catalog.length === 0 && bundles.length === 0
                            ? "No saved services yet"
                            : available.length === 0
                              ? "No more services"
                              : "Search services and bundles…"
                    }
                    onFocus={() => setOpen(true)}
                    onBlur={() => setOpen(false)}
                    onChange={(e) => {
                        setQuery(e.target.value);
                        setOpen(true);
                        setActive(0);
                    }}
                    onKeyDown={onKeyDown}
                    className="w-full rounded border border-line bg-paper py-2 pl-9 pr-9 text-sm text-ink placeholder:text-muted outline-none focus:border-clinical-500 disabled:opacity-50"
                />
                {query && (
                    <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                            setQuery("");
                            setActive(0);
                        }}
                        aria-label="Clear search"
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-ink"
                    >
                        <X size={14} strokeWidth={1.75} />
                    </button>
                )}
            </div>

            {open && available.length > 0 && (
                <ul
                    id="service-results"
                    role="listbox"
                    className="mt-1 max-h-56 divide-y divide-line overflow-y-auto rounded border border-line bg-surface"
                >
                    {matches.length === 0 ? (
                        <li className="px-3 py-2.5 text-sm text-muted">
                            No match for “{query.trim()}”.
                        </li>
                    ) : (
                        matches.map((r, i) => {
                            const isB = r.kind === "bundle";
                            const src = isB ? r.b : r.s;
                            const price = isB
                                ? bundleAmounts(r.b, 1, taxById).base
                                : r.s.fee;
                            return (
                                <li
                                    key={`${r.kind}-${r.id}`}
                                    role="option"
                                    aria-selected={i === active}
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={() => add(r)}
                                    onMouseEnter={() => setActive(i)}
                                    className={`cursor-pointer px-3 py-2.5 ${i === active ? "bg-clinical-50" : ""}`}
                                >
                                    <div className="flex items-baseline justify-between gap-3">
                                        <span className="flex min-w-0 items-center gap-2 text-sm text-ink">
                                            <span className="truncate">
                                                {src.name}
                                            </span>
                                            {isB && (
                                                <span className="shrink-0 rounded-full border border-clinical-500 bg-clinical-50 px-1.5 py-0.5 text-[10px] text-clinical-600">
                                                    Bundle · {r.b.items.length}
                                                </span>
                                            )}
                                        </span>
                                        <span className="shrink-0 text-xs text-muted">
                                            {money(price)}
                                        </span>
                                    </div>
                                    {src.description && (
                                        <p className="truncate text-xs text-muted">
                                            {src.description}
                                        </p>
                                    )}
                                </li>
                            );
                        })
                    )}
                </ul>
            )}

            {allowAdhoc && !adhocOpen && (
                <button
                    type="button"
                    onClick={() => setAdhocOpen(true)}
                    disabled={disabled}
                    className="mt-2 inline-flex items-center gap-1.5 text-xs text-clinical-600 hover:underline disabled:opacity-40"
                >
                    <PlusCircle size={14} strokeWidth={1.75} />
                    Add one-off service
                </button>
            )}

            {allowAdhoc && adhocOpen && (
                <div className="mt-2 rounded border border-line bg-paper p-3">
                    <p className="text-xs text-muted">
                        Billed for this consultation only. Not added to your
                        rate card.
                    </p>
                    <div className="mt-2 space-y-2">
                        <label className="block">
                            <input
                                className={fieldCls}
                                placeholder="Service name"
                                maxLength={80}
                                value={ad.name}
                                onChange={(e) =>
                                    setAd({ ...ad, name: e.target.value })
                                }
                            />
                            {adErr.name && (
                                <span className="mt-1 block text-xs text-alert-500">
                                    {adErr.name}
                                </span>
                            )}
                        </label>
                        <textarea
                            className={fieldCls}
                            rows={2}
                            maxLength={200}
                            placeholder="Description (optional). Prints on the bill."
                            value={ad.description}
                            onChange={(e) =>
                                setAd({ ...ad, description: e.target.value })
                            }
                        />
                        <div className="grid grid-cols-3 gap-2">
                            <input
                                className={fieldCls}
                                inputMode="decimal"
                                placeholder="Price ₹"
                                value={ad.fee}
                                onChange={(e) =>
                                    setAd({ ...ad, fee: e.target.value })
                                }
                            />
                            <input
                                className={fieldCls}
                                inputMode="numeric"
                                placeholder="Qty"
                                value={ad.qty}
                                onChange={(e) =>
                                    setAd({ ...ad, qty: e.target.value })
                                }
                            />
                            <select
                                className={fieldCls}
                                value={ad.tax_id}
                                onChange={(e) =>
                                    setAd({ ...ad, tax_id: e.target.value })
                                }
                            >
                                <option value="">No tax</option>
                                {taxes.map((t) => (
                                    <option key={t.id} value={t.id}>
                                        {t.name} ({t.rate}%)
                                    </option>
                                ))}
                            </select>
                        </div>
                        {(adErr.fee || adErr.qty) && (
                            <p className="text-xs text-alert-500">
                                {[
                                    adErr.fee && `Price: ${adErr.fee}`,
                                    adErr.qty && `Qty: ${adErr.qty}`,
                                ]
                                    .filter(Boolean)
                                    .join(" · ")}
                            </p>
                        )}
                    </div>
                    <div className="mt-3 flex gap-2">
                        <button
                            type="button"
                            onClick={() => {
                                setAdhocOpen(false);
                                setAd(BLANK);
                                setAdErr({});
                            }}
                            className="rounded border border-line bg-surface px-4 py-2 text-sm text-ink hover:bg-paper"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={addAdhoc}
                            className="flex-1 rounded bg-clinical-500 py-2 text-sm font-medium text-paper hover:bg-clinical-600"
                        >
                            Add to bill
                        </button>
                    </div>
                </div>
            )}

            {rows.length > 0 && (
                <>
                    <ul className="mt-3 divide-y divide-line overflow-hidden rounded border border-line">
                        {rows.map((r) => {
                            const { v, kind } = r;
                            const key = keyOf(v);
                            const isB = kind === "bundle";
                            const src = isB ? r.b : r.s;
                            const t = isB ? null : taxById[r.s.tax_id];
                            const a = amountsOf(r);
                            const mode =
                                v.mode === "services" ? "services" : "named";
                            return (
                                <li key={key} className="px-3 py-2.5">
                                    <div className="flex items-center gap-3">
                                        <div className="min-w-0 flex-1">
                                            <p className="flex items-center gap-2 text-sm text-ink">
                                                <span className="truncate">
                                                    {src.name}
                                                </span>
                                                {kind === "adhoc" && (
                                                    <span className="shrink-0 rounded-full border border-line bg-paper px-1.5 py-0.5 text-[10px] text-muted">
                                                        One-off
                                                    </span>
                                                )}
                                                {isB && (
                                                    <span className="shrink-0 rounded-full border border-clinical-500 bg-clinical-50 px-1.5 py-0.5 text-[10px] text-clinical-600">
                                                        Bundle
                                                    </span>
                                                )}
                                            </p>
                                            {src.description && (
                                                <p className="truncate text-xs text-muted">
                                                    {src.description}
                                                </p>
                                            )}
                                            {isB ? (
                                                <>
                                                    <p className="truncate text-xs text-muted">
                                                        {r.b.items
                                                            .map(
                                                                (m) =>
                                                                    `${m.name}${m.qty > 1 ? ` ×${m.qty}` : ""}`,
                                                            )
                                                            .join(", ")}
                                                    </p>
                                                    <p className="text-xs text-muted">
                                                        {money(a.base / v.qty)}{" "}
                                                        × {v.qty} · tax per
                                                        service
                                                    </p>
                                                </>
                                            ) : (
                                                <p className="text-xs text-muted">
                                                    {money(r.s.fee)} × {v.qty}
                                                    {t
                                                        ? ` · ${t.name} ${t.rate}%`
                                                        : ""}
                                                </p>
                                            )}
                                        </div>
                                        <div className="flex shrink-0 items-center gap-1">
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setQty(key, v.qty - 1)
                                                }
                                                disabled={
                                                    disabled || v.qty <= 1
                                                }
                                                aria-label="Decrease quantity"
                                                className="rounded border border-line p-1 text-muted hover:text-ink disabled:opacity-40"
                                            >
                                                <Minus
                                                    size={12}
                                                    strokeWidth={2}
                                                />
                                            </button>
                                            <span className="w-6 text-center text-sm text-ink">
                                                {v.qty}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setQty(key, v.qty + 1)
                                                }
                                                disabled={
                                                    disabled || v.qty >= 99
                                                }
                                                aria-label="Increase quantity"
                                                className="rounded border border-line p-1 text-muted hover:text-ink disabled:opacity-40"
                                            >
                                                <Plus
                                                    size={12}
                                                    strokeWidth={2}
                                                />
                                            </button>
                                        </div>
                                        <p className="w-20 shrink-0 text-right text-sm text-ink">
                                            {money(a.total)}
                                        </p>
                                        <button
                                            type="button"
                                            onClick={() => remove(key)}
                                            disabled={disabled}
                                            aria-label={`Remove ${src.name}`}
                                            className="shrink-0 text-muted hover:text-alert-500 disabled:opacity-40"
                                        >
                                            <X size={14} strokeWidth={1.75} />
                                        </button>
                                    </div>

                                    {isB && bundleMode && (
                                        <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
                                            <span className="text-muted">
                                                On the bill:
                                            </span>
                                            <div className="inline-flex overflow-hidden rounded border border-line">
                                                {[
                                                    [
                                                        "named",
                                                        "Bundle name + services",
                                                    ],
                                                    [
                                                        "services",
                                                        "Services only",
                                                    ],
                                                ].map(([m, label]) => (
                                                    <button
                                                        key={m}
                                                        type="button"
                                                        onClick={() =>
                                                            setMode(key, m)
                                                        }
                                                        disabled={disabled}
                                                        className={`px-2.5 py-1 transition-colors ${
                                                            mode === m
                                                                ? "bg-clinical-500 text-paper"
                                                                : "bg-surface text-ink hover:bg-paper"
                                                        }`}
                                                    >
                                                        {label}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                    <div className="mt-2 space-y-0.5 text-right text-xs text-muted">
                        <p>Subtotal {money(r2(sub))}</p>
                        <p>Tax {money(r2(taxSum))}</p>
                        <p className="text-sm font-medium text-ink">
                            Total {money(r2(sub + taxSum))}
                        </p>
                    </div>
                </>
            )}
        </div>
    );
}
