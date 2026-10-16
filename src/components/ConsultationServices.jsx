import React, { useEffect, useState } from "react";
import ServicePicker from "./ServicePicker";
import {
    getRateCard,
    getConsultationServices,
    saveConsultationServices,
} from "../api/processAudio";

export default function ConsultationServices({
    consultationId,
    saveLabel = "Save services",
    requireItems = false,
    allowAdhoc = false,
    bundleMode = false,
    onSaved,
}) {
    const [catalog, setCatalog] = useState([]);
    const [taxes, setTaxes] = useState([]);
    const [items, setItems] = useState([]);
    const [source, setSource] = useState("none");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [dirty, setDirty] = useState(false);
    const [error, setError] = useState("");
    const [bundles, setBundles] = useState([]);
    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setError("");
        Promise.all([getRateCard(), getConsultationServices(consultationId)])
            .then(([rc, cs]) => {
                if (cancelled) return;
                setCatalog(rc.services);
                setTaxes(rc.taxes);
                setBundles(rc.bundles || []);
                setItems(cs.items);
                setSource(cs.source);
                setDirty(false);
            })
            .catch(
                (err) =>
                    !cancelled &&
                    setError(err.message || "Couldn't load services"),
            )
            .finally(() => !cancelled && setLoading(false));
        return () => {
            cancelled = true;
        };
    }, [consultationId]);

    const change = (next) => {
        setItems(next);
        setDirty(true);
        setError("");
    };

    const save = async () => {
        setError("");
        if (requireItems && items.length === 0) {
            setError("Add at least one service.");
            return;
        }
        // Nothing changed and already saved: do not rebuild an existing bill
        if (!dirty && source === "saved") {
            onSaved?.(items);
            return;
        }
        setSaving(true);
        try {
            const saved = await saveConsultationServices(consultationId, items);
            setItems(saved);
            setSource("saved");
            setDirty(false);
            onSaved?.(saved);
        } catch (err) {
            setError(err.message || "Couldn't save services");
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return <p className="py-8 text-center text-sm text-muted">Loading…</p>;
    }

    return (
        <div className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 overflow-y-auto">
                {source === "pending" && !dirty && items.length > 0 && (
                    <p className="mb-3 text-xs text-muted">
                        Pre-filled by front desk. Save to confirm.
                    </p>
                )}
                <ServicePicker
                    catalog={catalog}
                    bundles={bundles}
                    taxes={taxes}
                    value={items}
                    onChange={change}
                    disabled={saving}
                    allowAdhoc={allowAdhoc}
                    bundleMode={bundleMode}
                    emptyHint="No services yet. Add them in Profile, under Service rate card."
                />
                {error && (
                    <p className="mt-3 text-sm text-alert-500">{error}</p>
                )}
            </div>
            {(catalog.length > 0 || bundles.length > 0 || allowAdhoc) && (
                <button
                    type="button"
                    onClick={save}
                    disabled={saving}
                    className="mt-3 w-full shrink-0 rounded bg-clinical-500 py-2.5 text-sm font-medium text-paper hover:bg-clinical-600 disabled:opacity-40 transition-colors"
                >
                    {saving ? "Saving…" : saveLabel}
                </button>
            )}
        </div>
    );
}
