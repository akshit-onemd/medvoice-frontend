import React, { useMemo } from "react";
import { Minus, Plus, X } from "lucide-react";
import { money, lineAmounts, r2 } from "../utils/money";

export default function ServicePicker({
    catalog,
    taxes,
    value,
    onChange,
    disabled = false,
    emptyHint = "No services yet.",
}) {
    const byId = useMemo(
        () => Object.fromEntries(catalog.map((s) => [s.id, s])),
        [catalog],
    );
    const taxById = useMemo(
        () => Object.fromEntries(taxes.map((t) => [t.id, t])),
        [taxes],
    );
    const available = catalog.filter(
        (s) => s.active && !value.some((v) => v.service_id === s.id),
    );
    const rows = value
        .map((v) => ({ v, s: byId[v.service_id] }))
        .filter((r) => r.s);

    const add = (id) => id && onChange([...value, { service_id: id, qty: 1 }]);
    const setQty = (id, qty) =>
        onChange(
            value.map((v) =>
                v.service_id === id
                    ? { ...v, qty: Math.min(99, Math.max(1, qty)) }
                    : v,
            ),
        );
    const remove = (id) => onChange(value.filter((v) => v.service_id !== id));

    let sub = 0;
    let taxSum = 0;
    rows.forEach(({ v, s }) => {
        const a = lineAmounts(s.fee, v.qty, taxById[s.tax_id]?.rate);
        sub += a.base;
        taxSum += a.tax;
    });

    if (catalog.length === 0) {
        return <p className="text-sm text-muted">{emptyHint}</p>;
    }

    return (
        <div>
            <select
                className="w-full rounded border border-line bg-paper px-3 py-2 text-sm text-ink focus:border-clinical-500 outline-none disabled:opacity-50"
                value=""
                onChange={(e) => add(e.target.value)}
                disabled={disabled || available.length === 0}
            >
                <option value="">
                    {available.length === 0
                        ? "No more services"
                        : "Add a service…"}
                </option>
                {available.map((s) => (
                    <option key={s.id} value={s.id}>
                        {s.name} · {money(s.fee)}
                    </option>
                ))}
            </select>

            {rows.length > 0 && (
                <>
                    <ul className="mt-3 rounded border border-line divide-y divide-line overflow-hidden">
                        {rows.map(({ v, s }) => {
                            const t = taxById[s.tax_id];
                            const a = lineAmounts(s.fee, v.qty, t?.rate);
                            return (
                                <li
                                    key={v.service_id}
                                    className="flex items-center gap-3 px-3 py-2.5"
                                >
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm text-ink truncate">
                                            {s.name}
                                        </p>
                                        <p className="text-xs text-muted">
                                            {money(s.fee)} × {v.qty}
                                            {t ? ` · ${t.name} ${t.rate}%` : ""}
                                        </p>
                                    </div>
                                    <div className="flex shrink-0 items-center gap-1">
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setQty(v.service_id, v.qty - 1)
                                            }
                                            disabled={disabled || v.qty <= 1}
                                            aria-label="Decrease quantity"
                                            className="rounded border border-line p-1 text-muted hover:text-ink disabled:opacity-40"
                                        >
                                            <Minus size={12} strokeWidth={2} />
                                        </button>
                                        <span className="w-6 text-center text-sm text-ink">
                                            {v.qty}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setQty(v.service_id, v.qty + 1)
                                            }
                                            disabled={disabled || v.qty >= 99}
                                            aria-label="Increase quantity"
                                            className="rounded border border-line p-1 text-muted hover:text-ink disabled:opacity-40"
                                        >
                                            <Plus size={12} strokeWidth={2} />
                                        </button>
                                    </div>
                                    <p className="w-20 shrink-0 text-right text-sm text-ink">
                                        {money(a.total)}
                                    </p>
                                    <button
                                        type="button"
                                        onClick={() => remove(v.service_id)}
                                        disabled={disabled}
                                        aria-label={`Remove ${s.name}`}
                                        className="shrink-0 text-muted hover:text-alert-500 disabled:opacity-40"
                                    >
                                        <X size={14} strokeWidth={1.75} />
                                    </button>
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
