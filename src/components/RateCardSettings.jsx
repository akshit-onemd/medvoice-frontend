import React, { useEffect, useRef, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import {
    getRateCard,
    createTax,
    updateTax,
    deleteTax,
    createService,
    updateService,
    deleteService,
} from "../api/processAudio";
import BundleSettings from "./BundleSettings";
const inputCls =
    "w-full rounded border border-line bg-paper px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-clinical-500 outline-none";

const money = (n) =>
    "₹" +
    Number(n).toLocaleString("en-IN", {
        minimumFractionDigits: Number.isInteger(Number(n)) ? 0 : 2,
        maximumFractionDigits: 2,
    });
const withTax = (fee, rate) =>
    Math.round((fee + (fee * rate) / 100) * 100) / 100;
const numOk = (v, min, max) => {
    const s = String(v).trim();
    if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
    const n = Number(s);
    return n >= min && n <= max ? n : null;
};

const blankTax = { id: null, name: "", rate: "" };
const blankSvc = {
    id: null,
    name: "",
    description: "",
    fee: "",
    tax_id: "",
    active: true,
};
function Err({ children }) {
    return children ? (
        <span className="block text-xs text-alert-500 mt-1">{children}</span>
    ) : null;
}

export default function RateCardSettings() {
    const [taxes, setTaxes] = useState([]);
    const [services, setServices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [busyId, setBusyId] = useState(null);
    const [bundles, setBundles] = useState([]);
    const [taxForm, setTaxForm] = useState(blankTax);
    const [taxErr, setTaxErr] = useState({});
    const [taxSaving, setTaxSaving] = useState(false);

    const [svcForm, setSvcForm] = useState(blankSvc);
    const [svcErr, setSvcErr] = useState({});
    const [svcSaving, setSvcSaving] = useState(false);
    const svcFormRef = useRef(null);
    const taxFormRef = useRef(null);

    const reload = async () => {
        const d = await getRateCard();
        setTaxes(d.taxes);
        setServices(d.services);
        setBundles(d.bundles || []);
    };

    useEffect(() => {
        reload()
            .catch((err) => setError(err.message || "Couldn't load rate card"))
            .finally(() => setLoading(false));
    }, []);

    const taxById = (id) => taxes.find((t) => t.id === id);

    const priceLine = (s) => {
        const t = taxById(s.tax_id);
        const base = t
            ? `${money(s.fee)} + ${t.name} ${t.rate}% = ${money(withTax(s.fee, t.rate))}`
            : `${money(s.fee)} · no tax`;
        return s.active ? base : `${base} · hidden`;
    };

    // ---- taxes ----
    const saveTax = async () => {
        const errs = {};
        const name = taxForm.name.trim().replace(/\s+/g, " ");
        if (name.length < 2) errs.name = "Enter a name";
        const rate = numOk(taxForm.rate, 0, 100);
        if (rate === null) errs.rate = "0 to 100, up to 2 decimals";
        setTaxErr(errs);
        if (Object.keys(errs).length) return;
        setTaxSaving(true);
        try {
            if (taxForm.id) await updateTax(taxForm.id, { name, rate });
            else await createTax({ name, rate });
            await reload();
            setTaxForm(blankTax);
        } catch (err) {
            setTaxErr({ form: err.message || "Couldn't save tax" });
        } finally {
            setTaxSaving(false);
        }
    };

    const editTax = (t) => {
        setTaxForm({ id: t.id, name: t.name, rate: String(t.rate) });
        setTaxErr({});
        taxFormRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "center",
        });
    };

    const removeTax = async (t) => {
        if (!window.confirm(`Delete tax “${t.name}”?`)) return;
        setBusyId(t.id);
        setError("");
        try {
            await deleteTax(t.id);
            await reload();
        } catch (err) {
            setError(err.message || "Couldn't delete tax");
        } finally {
            setBusyId(null);
        }
    };

    // ---- services ----
    const saveSvc = async () => {
        const errs = {};
        const name = svcForm.name.trim().replace(/\s+/g, " ");
        if (name.length < 2) errs.name = "Enter a service name";
        const fee = numOk(svcForm.fee, 0, 10000000);
        if (fee === null) errs.fee = "Enter an amount, up to 2 decimals";
        setSvcErr(errs);
        if (Object.keys(errs).length) return;
        setSvcSaving(true);
        try {
            const body = {
                name,
                description: svcForm.description.trim(),
                fee,
                tax_id: svcForm.tax_id || "",
                active: svcForm.active,
            };
            if (svcForm.id) await updateService(svcForm.id, body);
            else await createService(body);
            await reload();
            setSvcForm(blankSvc);
        } catch (err) {
            setSvcErr({ form: err.message || "Couldn't save service" });
        } finally {
            setSvcSaving(false);
        }
    };

    const editSvc = (s) => {
        setSvcForm({
            id: s.id,
            name: s.name,
            description: s.description || "",
            fee: String(s.fee),
            tax_id: s.tax_id || "",
            active: s.active,
        });
        setSvcErr({});
        svcFormRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "center",
        });
    };

    const toggleSvc = async (s) => {
        setBusyId(s.id);
        setError("");
        try {
            await updateService(s.id, {
                name: s.name,
                description: s.description || "",
                fee: s.fee,
                tax_id: s.tax_id || "",
                active: !s.active,
            });
            await reload();
        } catch (err) {
            setError(err.message || "Couldn't update service");
        } finally {
            setBusyId(null);
        }
    };

    const removeSvc = async (s) => {
        if (!window.confirm(`Delete service “${s.name}”?`)) return;
        setBusyId(s.id);
        setError("");
        try {
            await deleteService(s.id);
            await reload();
        } catch (err) {
            setError(err.message || "Couldn't delete service");
        } finally {
            setBusyId(null);
        }
    };

    return (
        <div className="bg-surface border border-line rounded-md shadow-panel p-6">
            <h2 className="font-serif text-xl text-ink">Service rate card</h2>
            <p className="text-sm text-muted mt-1">
                Services and fees for billing. Tax is added on top of the fee.
            </p>

            {loading && <p className="mt-4 text-sm text-muted">Loading…</p>}
            {error && <p className="mt-4 text-sm text-alert-500">{error}</p>}

            {!loading && (
                <>
                    {/* ---------- Taxes ---------- */}
                    <p className="mt-6 text-[11px] font-medium uppercase tracking-wide text-muted">
                        Tax brackets
                    </p>
                    {taxes.length === 0 ? (
                        <p className="mt-2 text-sm text-muted">
                            No tax brackets yet.
                        </p>
                    ) : (
                        <ul className="mt-2 rounded border border-line divide-y divide-line overflow-hidden">
                            {taxes.map((t) => (
                                <li
                                    key={t.id}
                                    className="flex items-center gap-3 px-3 py-2.5"
                                >
                                    <p className="min-w-0 flex-1 text-sm text-ink truncate">
                                        {t.name}
                                        <span className="text-muted">
                                            · {t.rate}%
                                        </span>
                                    </p>
                                    <button
                                        type="button"
                                        onClick={() => editTax(t)}
                                        aria-label={`Edit ${t.name}`}
                                        className="text-muted hover:text-ink"
                                    >
                                        <Pencil size={14} strokeWidth={1.75} />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => removeTax(t)}
                                        disabled={busyId === t.id}
                                        aria-label={`Delete ${t.name}`}
                                        className="text-alert-500 hover:opacity-70 disabled:opacity-40"
                                    >
                                        <Trash2 size={14} strokeWidth={1.75} />
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}

                    <div
                        ref={taxFormRef}
                        className="mt-3 rounded border border-line bg-paper p-3"
                    >
                        <p className="text-xs text-muted mb-2">
                            {taxForm.id ? "Edit tax" : "Add tax"}
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <label className="block">
                                <input
                                    className={inputCls}
                                    placeholder="Name, e.g. GST"
                                    value={taxForm.name}
                                    onChange={(e) =>
                                        setTaxForm({
                                            ...taxForm,
                                            name: e.target.value,
                                        })
                                    }
                                />
                                <Err>{taxErr.name}</Err>
                            </label>
                            <label className="block">
                                <input
                                    className={inputCls}
                                    inputMode="decimal"
                                    placeholder="Rate %, e.g. 18"
                                    value={taxForm.rate}
                                    onChange={(e) =>
                                        setTaxForm({
                                            ...taxForm,
                                            rate: e.target.value,
                                        })
                                    }
                                />
                                <Err>{taxErr.rate}</Err>
                            </label>
                        </div>
                        <Err>{taxErr.form}</Err>
                        <div className="mt-3 flex gap-3">
                            {taxForm.id && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setTaxForm(blankTax);
                                        setTaxErr({});
                                    }}
                                    className="rounded border border-line bg-surface px-4 py-2 text-sm text-ink hover:bg-paper"
                                >
                                    Cancel
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={saveTax}
                                disabled={taxSaving}
                                className="rounded bg-clinical-500 px-4 py-2 text-sm font-medium text-paper hover:bg-clinical-600 disabled:opacity-40"
                            >
                                {taxSaving
                                    ? "Saving…"
                                    : taxForm.id
                                      ? "Save tax"
                                      : "Add tax"}
                            </button>
                        </div>
                    </div>

                    {/* ---------- Services ---------- */}
                    <p className="mt-8 text-[11px] font-medium uppercase tracking-wide text-muted">
                        Services
                    </p>
                    {services.length === 0 ? (
                        <p className="mt-2 text-sm text-muted">
                            No services yet.
                        </p>
                    ) : (
                        <ul className="mt-2 rounded border border-line divide-y divide-line overflow-hidden">
                            {services.map((s) => (
                                <li
                                    key={s.id}
                                    className={`flex items-center gap-3 px-3 py-3 ${s.active ? "" : "opacity-60"}`}
                                >
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm text-ink truncate">
                                            {s.name}
                                        </p>
                                        {s.description && (
                                            <p className="text-xs text-muted truncate">
                                                {s.description}
                                            </p>
                                        )}
                                        <p className="text-xs text-muted">
                                            {priceLine(s)}
                                        </p>
                                    </div>
                                    <label className="inline-flex shrink-0 items-center gap-1.5 text-xs text-muted">
                                        <input
                                            type="checkbox"
                                            checked={s.active}
                                            disabled={busyId === s.id}
                                            onChange={() => toggleSvc(s)}
                                        />
                                        Active
                                    </label>
                                    <button
                                        type="button"
                                        onClick={() => editSvc(s)}
                                        aria-label={`Edit ${s.name}`}
                                        className="text-muted hover:text-ink"
                                    >
                                        <Pencil size={14} strokeWidth={1.75} />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => removeSvc(s)}
                                        disabled={busyId === s.id}
                                        aria-label={`Delete ${s.name}`}
                                        className="text-alert-500 hover:opacity-70 disabled:opacity-40"
                                    >
                                        <Trash2 size={14} strokeWidth={1.75} />
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}

                    <div
                        ref={svcFormRef}
                        className="mt-3 rounded border border-line bg-paper p-3"
                    >
                        <p className="text-xs text-muted mb-2">
                            {svcForm.id ? "Edit service" : "Add service"}
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <label className="block">
                                <input
                                    className={inputCls}
                                    placeholder="Service, e.g. Consultation Fees"
                                    value={svcForm.name}
                                    onChange={(e) =>
                                        setSvcForm({
                                            ...svcForm,
                                            name: e.target.value,
                                        })
                                    }
                                />
                                <Err>{svcErr.name}</Err>
                            </label>
                            <label className="block">
                                <input
                                    className={inputCls}
                                    inputMode="decimal"
                                    placeholder="Fee in ₹, e.g. 1500"
                                    value={svcForm.fee}
                                    onChange={(e) =>
                                        setSvcForm({
                                            ...svcForm,
                                            fee: e.target.value,
                                        })
                                    }
                                />
                                <Err>{svcErr.fee}</Err>
                            </label>
                            <label className="block">
                                <select
                                    className={inputCls}
                                    value={svcForm.tax_id}
                                    onChange={(e) =>
                                        setSvcForm({
                                            ...svcForm,
                                            tax_id: e.target.value,
                                        })
                                    }
                                >
                                    <option value="">No tax</option>
                                    {taxes.map((t) => (
                                        <option key={t.id} value={t.id}>
                                            {t.name} ({t.rate}%)
                                        </option>
                                    ))}
                                </select>
                            </label>
                            <label className="inline-flex items-center gap-2 text-sm text-ink">
                                <input
                                    type="checkbox"
                                    checked={svcForm.active}
                                    onChange={(e) =>
                                        setSvcForm({
                                            ...svcForm,
                                            active: e.target.checked,
                                        })
                                    }
                                />
                                Active
                            </label>
                        </div>
                        <label className="mt-3 block">
                            <textarea
                                className={inputCls}
                                rows={2}
                                maxLength={200}
                                placeholder="Description (optional). Prints on the bill."
                                value={svcForm.description}
                                onChange={(e) =>
                                    setSvcForm({
                                        ...svcForm,
                                        description: e.target.value,
                                    })
                                }
                            />
                            <span className="mt-1 block text-right text-[11px] text-muted">
                                {svcForm.description.length}/200
                            </span>
                        </label>
                        <Err>{svcErr.form}</Err>
                        <div className="mt-3 flex gap-3">
                            {svcForm.id && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSvcForm(blankSvc);
                                        setSvcErr({});
                                    }}
                                    className="rounded border border-line bg-surface px-4 py-2 text-sm text-ink hover:bg-paper"
                                >
                                    Cancel
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={saveSvc}
                                disabled={svcSaving}
                                className="rounded bg-clinical-500 px-4 py-2 text-sm font-medium text-paper hover:bg-clinical-600 disabled:opacity-40"
                            >
                                {svcSaving
                                    ? "Saving…"
                                    : svcForm.id
                                      ? "Save service"
                                      : "Add service"}
                            </button>
                        </div>
                    </div>
                    <BundleSettings
                        services={services}
                        taxes={taxes}
                        bundles={bundles}
                        onChanged={reload}
                    />
                </>
            )}
        </div>
    );
}
