import React, { useState } from "react";
import { Loader2, Search } from "lucide-react";
import { getPatientConsultations, previewTemplate, searchPatients } from "../../api/processAudio";
import { SECTION_TYPES } from "../../templates/sectionTypes";
import { isEmptyGeneral, isGeneral } from "../../templates/general";
import GeneralSectionCard from "../sections/GeneralSectionCard";

const at = (o, path) => path.split(".").reduce((x, k) => x?.[k], o);
const rowText = (r) =>
    typeof r !== "object" || !r
        ? String(r || "")
        : r.value !== undefined && r.name
          ? r.value
              ? `${r.name}: ${r.value}${r.units ? ` ${r.units}` : ""}`
              : ""
          : Object.values(r)
                .filter((v) => typeof v === "string" && v.trim())
                .slice(0, 3)
                .join(" · ");

// Runs a template on a past visit's recording and shows what the note would hold. Nothing is saved.
export default function TryOnVisit({ def }) {
    const [q, setQ] = useState("");
    const [patients, setPatients] = useState([]);
    const [visits, setVisits] = useState(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [out, setOut] = useState(null);

    const find = async () => {
        if (q.trim().length < 2) return;
        setError("");
        try {
            setPatients(await searchPatients(q.trim()));
        } catch {
            setError("Couldn't search patients");
        }
    };
    const pickPatient = async (p) => {
        setPatients([]);
        setVisits(null);
        try {
            setVisits(await getPatientConsultations(p.id));
        } catch {
            setError("Couldn't load visits");
        }
    };
    const run = async (cid) => {
        setBusy(true);
        setError("");
        setOut(null);
        try {
            const body = await previewTemplate(cid, def);
            setOut(body);
        } catch (err) {
            setError(err.message || "Couldn't try the template");
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="space-y-3">
            <p className="text-xs text-muted">
                Pick a past visit with a recording. The template runs on its transcript; nothing is saved.
            </p>
            <div className="flex gap-2">
                <input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && find()}
                    placeholder="Patient name or phone"
                    className="w-full rounded border border-line bg-surface px-3 py-2.5 text-sm text-ink outline-none focus:border-clinical-500"
                />
                <button type="button" onClick={find} aria-label="Search" className="rounded border border-line bg-paper px-3 text-muted hover:text-ink">
                    <Search size={14} />
                </button>
            </div>
            {patients.length > 0 && (
                <ul className="divide-y divide-line rounded border border-line">
                    {patients.map((p) => (
                        <li key={p.id}>
                            <button type="button" onClick={() => pickPatient(p)} className="w-full px-3 py-2 text-left text-sm hover:bg-paper">
                                {p.name} <span className="text-xs text-muted">{p.phone}</span>
                            </button>
                        </li>
                    ))}
                </ul>
            )}
            {visits && (
                <ul className="divide-y divide-line rounded border border-line">
                    {visits.length === 0 && <li className="px-3 py-2 text-sm text-muted">No visits</li>}
                    {visits.slice(0, 10).map((v) => (
                        <li key={v.id}>
                            <button
                                type="button"
                                disabled={busy}
                                onClick={() => run(v.id)}
                                className="w-full px-3 py-2 text-left text-sm hover:bg-paper disabled:opacity-50"
                            >
                                {new Date(v.created_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                            </button>
                        </li>
                    ))}
                </ul>
            )}
            {busy && (
                <p className="flex items-center gap-2 text-sm text-muted">
                    <Loader2 size={14} className="animate-spin" /> Writing the note with this template…
                </p>
            )}
            {error && <p className="text-sm text-alert-500">{error}</p>}
            {out && (
                <div className="space-y-3">
                    {(out.definition?.sections || []).map((s) => {
                        if (isGeneral(s)) {
                            const v = out.structured_data?.custom?.[s.id];
                            return isEmptyGeneral(s, v) ? (
                                <p key={s.id} className="text-xs text-muted">
                                    {s.title}: not mentioned
                                </p>
                            ) : (
                                <GeneralSectionCard key={s.id} section={s} value={v} title={s.title} />
                            );
                        }
                        const t = SECTION_TYPES[s.type];
                        const rows = (at(out.structured_data, t?.key || "") || []).map(rowText).filter(Boolean);
                        return (
                            <div key={s.id} className="rounded border border-line bg-surface px-4 py-3">
                                <p className="text-sm font-medium text-ink">{s.title || t?.title}</p>
                                {rows.length ? (
                                    <ul className="mt-1 list-disc pl-5 text-sm text-ink">
                                        {rows.map((r, i) => (
                                            <li key={i}>{r}</li>
                                        ))}
                                    </ul>
                                ) : (
                                    <p className="text-xs text-muted">Not mentioned</p>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
