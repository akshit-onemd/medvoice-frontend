import React, { useMemo, useRef, useState } from "react";
import { Minus, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { createBundle, updateBundle, deleteBundle } from "../api/processAudio";
import { money, bundleAmounts } from "../utils/money";

const inputCls =
    "w-full rounded border border-line bg-paper px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-clinical-500 outline-none";
const blank = { id: null, name: "", description: "", active: true, items: [] };

export default function BundleSettings({
    services,
    taxes,
    bundles,
    onChanged,
}) {
    const [form, setForm] = useState(blank);
    const [errs, setErrs] = useState({});
    const [saving, setSaving] = useState(false);
    const [busyId, setBusyId] = useState(null);
    const [error, setError] = useState("");
    const [query, setQuery] = useState("");
    const [open, setOpen] = useState(false);
    const formRef = useRef(null);

    const svcById = useMemo(
        () => Object.fromEntries(services.map((s) => [s.id, s])),
        [services],
    );
    const taxById = useMemo(
        () => Object.fromEntries(taxes.map((t) => [t.id, t])),
        [taxes],
    );

    const members = form.items
        .map((m) => {
            const s = svcById[m.service_id];
            return s
                ? {
                      ...m,
                      name: s.name,
                      fee: s.fee,
                      tax_id: s.tax_id,
                      active: s.active,
                  }
                : null;
        })
        .filter(Boolean);
    const preview = bundleAmounts({ items: members }, 1, taxById);

    const available = useMemo(() => {
        const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
        return services.filter((s) => {
            if (!s.active || form.items.some((m) => m.service_id === s.id))
                return false;
            const hay = `${s.name} ${s.description || ""}`.toLowerCase();
            return tokens.every((t) => hay.includes(t));
        });
    }, [services, form.items, query]);

    const addMember = (s) => {
        setForm((f) => ({
            ...f,
            items: [...f.items, { service_id: s.id, qty: 1 }],
        }));
        setErrs((e) => ({ ...e, items: "" }));
        setQuery("");
    };
    const setQty = (id, qty) =>
        setForm((f) => ({
            ...f,
            items: f.items.map((m) =>
                m.service_id === id
                    ? { ...m, qty: Math.min(99, Math.max(1, qty)) }
                    : m,
            ),
        }));
    const removeMember = (id) =>
        setForm((f) => ({
            ...f,
            items: f.items.filter((m) => m.service_id !== id),
        }));

    const edit = (b) => {
        setForm({
            id: b.id,
            name: b.name,
            description: b.description || "",
            active: b.active,
            items: b.items.map((m) => ({
                service_id: m.service_id,
                qty: m.qty,
            })),
        });
        setErrs({});
        setError("");
        formRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "center",
        });
    };

    const save = async () => {
        const e = {};
        const name = form.name.trim().replace(/\s+/g, " ");
        if (name.length < 2) e.name = "Enter a bundle name";
        if (form.items.length === 0) e.items = "Add at least one service";
        setErrs(e);
        if (Object.keys(e).length) return;
        setSaving(true);
        try {
            const body = {
                name,
                description: form.description.trim(),
                active: form.active,
                items: form.items.map((m) => ({
                    service_id: m.service_id,
                    qty: m.qty,
                })),
            };
            if (form.id) await updateBundle(form.id, body);
            else await createBundle(body);
            await onChanged();
            setForm(blank);
            setErrs({});
        } catch (err) {
            setErrs({ form: err.message || "Couldn't save bundle" });
        } finally {
            setSaving(false);
        }
    };

    const toggle = async (b) => {
        setBusyId(b.id);
        setError("");
        try {
            await updateBundle(b.id, {
                name: b.name,
                description: b.description || "",
                active: !b.active,
                items: b.items.map((m) => ({
                    service_id: m.service_id,
                    qty: m.qty,
                })),
            });
            await onChanged();
        } catch (err) {
            setError(err.message || "Couldn't update bundle");
        } finally {
            setBusyId(null);
        }
    };

    const remove = async (b) => {
        if (!window.confirm(`Delete bundle “${b.name}”?`)) return;
        setBusyId(b.id);
        setError("");
        try {
            await deleteBundle(b.id);
            await onChanged();
        } catch (err) {
            setError(err.message || "Couldn't delete bundle");
        } finally {
            setBusyId(null);
        }
    };

    return (
        <div>
            <p className="mt-8 text-[11px] font-medium uppercase tracking-wide text-muted">
                Bundles
            </p>
            <p className="mt-1 text-xs text-muted">
                Group services into one item. Pick the bundle while creating a
                bill.
            </p>
            {error && <p className="mt-2 text-sm text-alert-500">{error}</p>}

            {bundles.length === 0 ? (
                <p className="mt-2 text-sm text-muted">No bundles yet.</p>
            ) : (
                <ul className="mt-2 divide-y divide-line overflow-hidden rounded border border-line">
                    {bundles.map((b) => {
                        const a = bundleAmounts(b, 1, taxById);
                        return (
                            <li
                                key={b.id}
                                className={`flex items-center gap-3 px-3 py-3 ${b.active ? "" : "opacity-60"}`}
                            >
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm text-ink">
                                        {b.name}
                                    </p>
                                    <p className="truncate text-xs text-muted">
                                        {b.items
                                            .map(
                                                (m) =>
                                                    `${m.name}${m.qty > 1 ? ` ×${m.qty}` : ""}`,
                                            )
                                            .join(", ")}
                                    </p>
                                    <p className="text-xs text-muted">
                                        {b.items.length} service
                                        {b.items.length === 1 ? "" : "s"} ·{" "}
                                        {money(a.total)} incl. tax
                                        {b.active ? "" : " · hidden"}
                                    </p>
                                </div>
                                <label className="inline-flex shrink-0 items-center gap-1.5 text-xs text-muted">
                                    <input
                                        type="checkbox"
                                        checked={b.active}
                                        disabled={busyId === b.id}
                                        onChange={() => toggle(b)}
                                    />
                                    Active
                                </label>
                                <button
                                    type="button"
                                    onClick={() => edit(b)}
                                    aria-label={`Edit ${b.name}`}
                                    className="text-muted hover:text-ink"
                                >
                                    <Pencil size={14} strokeWidth={1.75} />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => remove(b)}
                                    disabled={busyId === b.id}
                                    aria-label={`Delete ${b.name}`}
                                    className="text-alert-500 hover:opacity-70 disabled:opacity-40"
                                >
                                    <Trash2 size={14} strokeWidth={1.75} />
                                </button>
                            </li>
                        );
                    })}
                </ul>
            )}

            <div
                ref={formRef}
                className="mt-3 rounded border border-line bg-paper p-3"
            >
                <p className="mb-2 text-xs text-muted">
                    {form.id ? "Edit bundle" : "Add bundle"}
                </p>

                <label className="block">
                    <input
                        className={inputCls}
                        placeholder="Bundle name, e.g. Thyroid Panel"
                        maxLength={80}
                        value={form.name}
                        onChange={(e) =>
                            setForm({ ...form, name: e.target.value })
                        }
                    />
                    {errs.name && (
                        <span className="mt-1 block text-xs text-alert-500">
                            {errs.name}
                        </span>
                    )}
                </label>
                <textarea
                    className={`${inputCls} mt-3`}
                    rows={2}
                    maxLength={200}
                    placeholder="Description (optional)"
                    value={form.description}
                    onChange={(e) =>
                        setForm({ ...form, description: e.target.value })
                    }
                />

                <p className="mb-1 mt-3 text-xs text-muted">
                    Services in this bundle
                </p>
                <div className="relative">
                    <Search
                        size={14}
                        strokeWidth={1.75}
                        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
                    />
                    <input
                        className={`${inputCls} pl-9`}
                        placeholder="Search services to add…"
                        autoComplete="off"
                        value={query}
                        onFocus={() => setOpen(true)}
                        onBlur={() => setOpen(false)}
                        onChange={(e) => {
                            setQuery(e.target.value);
                            setOpen(true);
                        }}
                    />
                </div>
                {open && (
                    <ul className="mt-1 max-h-48 divide-y divide-line overflow-y-auto rounded border border-line bg-surface">
                        {available.length === 0 ? (
                            <li className="px-3 py-2.5 text-sm text-muted">
                                {services.length === 0
                                    ? "Add services first."
                                    : "No match."}
                            </li>
                        ) : (
                            available.map((s) => (
                                <li
                                    key={s.id}
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={() => addMember(s)}
                                    className="cursor-pointer px-3 py-2.5 hover:bg-clinical-50"
                                >
                                    <div className="flex items-baseline justify-between gap-3">
                                        <span className="truncate text-sm text-ink">
                                            {s.name}
                                        </span>
                                        <span className="shrink-0 text-xs text-muted">
                                            {money(s.fee)}
                                        </span>
                                    </div>
                                    {s.description && (
                                        <p className="truncate text-xs text-muted">
                                            {s.description}
                                        </p>
                                    )}
                                </li>
                            ))
                        )}
                    </ul>
                )}
                {errs.items && (
                    <p className="mt-1 text-xs text-alert-500">{errs.items}</p>
                )}

                {members.length > 0 && (
                    <>
                        <ul className="mt-2 divide-y divide-line overflow-hidden rounded border border-line bg-surface">
                            {members.map((m) => (
                                <li
                                    key={m.service_id}
                                    className="flex items-center gap-3 px-3 py-2"
                                >
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm text-ink">
                                            {m.name}
                                            {!m.active && (
                                                <span className="ml-2 text-[11px] text-muted">
                                                    inactive
                                                </span>
                                            )}
                                        </p>
                                        <p className="text-xs text-muted">
                                            {money(m.fee)} × {m.qty}
                                        </p>
                                    </div>
                                    <div className="flex shrink-0 items-center gap-1">
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setQty(m.service_id, m.qty - 1)
                                            }
                                            disabled={m.qty <= 1}
                                            aria-label="Decrease quantity"
                                            className="rounded border border-line p-1 text-muted hover:text-ink disabled:opacity-40"
                                        >
                                            <Minus size={12} strokeWidth={2} />
                                        </button>
                                        <span className="w-6 text-center text-sm text-ink">
                                            {m.qty}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setQty(m.service_id, m.qty + 1)
                                            }
                                            disabled={m.qty >= 99}
                                            aria-label="Increase quantity"
                                            className="rounded border border-line p-1 text-muted hover:text-ink disabled:opacity-40"
                                        >
                                            <Plus size={12} strokeWidth={2} />
                                        </button>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() =>
                                            removeMember(m.service_id)
                                        }
                                        aria-label={`Remove ${m.name}`}
                                        className="shrink-0 text-muted hover:text-alert-500"
                                    >
                                        <X size={14} strokeWidth={1.75} />
                                    </button>
                                </li>
                            ))}
                        </ul>
                        <p className="mt-2 text-right text-xs text-muted">
                            Price {money(preview.base)} + tax{" "}
                            {money(preview.tax)} ={" "}
                            <span className="text-sm font-medium text-ink">
                                {money(preview.total)}
                            </span>
                        </p>
                    </>
                )}

                <label className="mt-3 inline-flex items-center gap-2 text-sm text-ink">
                    <input
                        type="checkbox"
                        checked={form.active}
                        onChange={(e) =>
                            setForm({ ...form, active: e.target.checked })
                        }
                    />
                    Active
                </label>

                {errs.form && (
                    <p className="mt-2 text-xs text-alert-500">{errs.form}</p>
                )}
                <div className="mt-3 flex gap-3">
                    {form.id && (
                        <button
                            type="button"
                            onClick={() => {
                                setForm(blank);
                                setErrs({});
                            }}
                            className="rounded border border-line bg-surface px-4 py-2 text-sm text-ink hover:bg-paper"
                        >
                            Cancel
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={save}
                        disabled={saving}
                        className="rounded bg-clinical-500 px-4 py-2 text-sm font-medium text-paper hover:bg-clinical-600 disabled:opacity-40"
                    >
                        {saving
                            ? "Saving…"
                            : form.id
                              ? "Save bundle"
                              : "Add bundle"}
                    </button>
                </div>
            </div>
        </div>
    );
}
