import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Copy, Loader2, Pencil, Plus, Sparkles, Star, Trash2, X } from "lucide-react";
import {
    copyTemplate,
    deleteTemplate,
    setDefaultTemplate,
} from "../../api/processAudio";
import ConfirmDialog from "../ConfirmDialog";
import TemplateOutline from "./TemplateOutline";
import TemplateEditor from "./TemplateEditor";
import TemplateChat from "./TemplateChat";
import { loadTemplateDef, setTemplateList, templatesChanged, useTemplateDef, useTemplateList } from "../../api/templateCache";

const KIND = { new: "New patient", follow_up: "Follow-up", condition: "Condition" };

function PreviewDialog({ id, onClose, actions }) {
    // Instant when this template was opened before
    const { data: t, error: loadError } = useTemplateDef(id);
    const error = loadError ? "Couldn't load the template" : "";
    useEffect(() => {
        const onKey = (e) => e.key === "Escape" && onClose();
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [onClose]);
    return createPortal(
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-ink/50 p-4"
            onMouseDown={(e) => e.target === e.currentTarget && onClose()}
        >
            <div role="dialog" aria-modal="true" className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-md border border-line bg-surface shadow-panel">
                <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
                    <div>
                        <h2 className="font-display text-lg text-ink">{t?.name || "Template"}</h2>
                        {t?.definition?.description && <p className="text-xs text-muted">{t.definition.description}</p>}
                    </div>
                    <button type="button" onClick={onClose} aria-label="Close" className="rounded p-1 text-muted hover:bg-paper hover:text-ink">
                        <X size={16} />
                    </button>
                </div>
                <div className="overflow-y-auto px-5 py-4">
                    {error && <p className="text-sm text-alert-500">{error}</p>}
                    {!t && !error && (
                        <p className="flex items-center gap-2 text-sm text-muted">
                            <Loader2 size={14} className="animate-spin" /> Loading…
                        </p>
                    )}
                    {t && <TemplateOutline def={t.definition} />}
                </div>
                {t && actions && <div className="flex flex-wrap gap-2 border-t border-line px-5 py-4">{actions(t)}</div>}
            </div>
        </div>,
        document.body,
    );
}

const btn = "inline-flex items-center gap-1.5 rounded border border-line bg-surface px-3 py-1.5 text-xs text-ink hover:bg-paper disabled:opacity-40";

// A mistake on this page shows a message instead of blanking the whole app
export default class TemplatesPageSafe extends React.Component {
    state = { error: null };
    static getDerivedStateFromError(error) {
        return { error };
    }
    componentDidCatch(error) {
        console.error("Templates page error:", error);
    }
    render() {
        if (this.state.error)
            return (
                <div className="mx-auto w-full max-w-3xl rounded-md border border-line bg-surface px-5 py-4 text-sm text-ink shadow-panel">
                    <p>Something went wrong on this page.</p>
                    <p className="mt-1 text-xs text-muted">{String(this.state.error?.message || this.state.error)}</p>
                    <button type="button" onClick={() => this.setState({ error: null })} className="mt-3 text-clinical-600 underline">
                        Back to templates
                    </button>
                </div>
            );
        return <TemplatesPage />;
    }
}

// Library + my templates, preview, add, edit, default, delete, create with AI
function TemplatesPage() {
    const { data: list, error: listError } = useTemplateList();
    const [tab, setTab] = useState("library");
    const [view, setView] = useState({ mode: "list" }); // list | edit | chat
    const [preview, setPreview] = useState(null);
    const [askDelete, setAskDelete] = useState(null);
    // Actions in progress, as "action:templateId". Only that template's buttons wait; the rest stay usable.
    const [busy, setBusy] = useState(() => new Set());
    const start = (key) => setBusy((s) => new Set(s).add(key));
    const stop = (key) =>
        setBusy((s) => {
            const n = new Set(s);
            n.delete(key);
            return n;
        });
    const rowBusy = (id) => [...busy].some((k) => k.endsWith(`:${id}`));
    const [error, setError] = useState("");
    const [filter, setFilter] = useState("");

    useEffect(() => {
        if (listError && !list) setError("Couldn't load templates");
    }, [listError, list]);
    // The doctor's own templates are few: fetch them ahead so Edit and Preview open at once
    useEffect(() => {
        (list || []).filter((t) => !t.builtin).forEach((t) => loadTemplateDef(t.id).catch(() => {}));
    }, [list]);

    const shown = useMemo(() => {
        const f = filter.trim().toLowerCase();
        return (list || [])
            .filter((t) => (tab === "library" ? t.builtin : !t.builtin))
            .filter((t) => !f || `${t.name} ${t.specialty || ""}`.toLowerCase().includes(f));
    }, [list, tab, filter]);
    const ownCount = (list || []).filter((t) => !t.builtin).length;

    const act = async (key, fn) => {
        start(key);
        setError("");
        try {
            await fn();
            await templatesChanged(key.split(":")[1]);
        } catch (err) {
            setError(err.message || "Something went wrong");
        } finally {
            stop(key);
        }
    };
    const addCopy = (t) =>
        act(`copy:${t.id}`, async () => {
            await copyTemplate(t.id);
            setPreview(null);
            setTab("mine");
        });
    // The badge moves at once; the server confirms (or the list is reloaded on an error)
    const makeDefault = (t) => {
        setTemplateList((list || []).map((x) => ({ ...x, isDefault: x.id === t.id })));
        return act(`def:${t.id}`, () => setDefaultTemplate(t.id));
    };
    const editOwn = async (t) => {
        start(`edit:${t.id}`);
        try {
            const full = await loadTemplateDef(t.id);
            setPreview(null);
            setView({
                mode: "edit",
                id: t.id,
                initial: { ...full.definition, name: full.name, specialty: full.specialty, kind: full.kind },
            });
        } catch {
            setError("Couldn't open the template");
        } finally {
            stop(`edit:${t.id}`);
        }
    };
    const done = () => {
        templatesChanged(view.id);
        setView({ mode: "list" });
        setTab("mine");
    };

    if (view.mode === "edit")
        return (
            <div className="mx-auto w-full max-w-5xl">
                <h2 className="mb-4 font-display text-2xl text-ink">{view.id ? "Edit template" : "New template"}</h2>
                <TemplateEditor initial={view.initial} templateId={view.id} onSaved={done} onCancel={() => setView({ mode: "list" })} />
            </div>
        );
    if (view.mode === "chat")
        return (
            <div className="mx-auto w-full max-w-5xl">
                <h2 className="mb-4 font-display text-2xl text-ink">New template</h2>
                <TemplateChat
                    onSaved={done}
                    onCancel={() => setView({ mode: "list" })}
                    onEditByHand={(draft) => setView({ mode: "edit", initial: draft })}
                />
            </div>
        );

    const spin = <Loader2 size={12} className="animate-spin" />;
    const rowActions = (t) => {
        const wait = rowBusy(t.id);
        const is = (a) => busy.has(`${a}:${t.id}`);
        return (
            <>
                {t.builtin ? (
                    <button type="button" className={btn} disabled={wait} onClick={() => addCopy(t)}>
                        {is("copy") ? spin : <Copy size={12} />}
                        {is("copy") ? "Adding…" : "Add to my templates"}
                    </button>
                ) : (
                    <>
                        <button type="button" className={btn} disabled={wait} onClick={() => editOwn(t)}>
                            {is("edit") ? spin : <Pencil size={12} />} Edit
                        </button>
                        <button
                            type="button"
                            className={`${btn} hover:text-alert-500`}
                            disabled={wait}
                            onClick={() => setAskDelete(t)}
                        >
                            {is("del") ? spin : <Trash2 size={12} />}
                            {is("del") ? "Deleting…" : "Delete"}
                        </button>
                    </>
                )}
                {!t.isDefault && (
                    <button type="button" className={btn} disabled={wait} onClick={() => makeDefault(t)}>
                        {is("def") ? spin : <Star size={12} />}
                        {is("def") ? "Setting…" : "Set as default"}
                    </button>
                )}
            </>
        );
    };

    return (
        <div className="mx-auto w-full max-w-3xl">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <h2 className="font-display text-2xl text-ink">Templates</h2>
                <div className="flex gap-2">
                    <button
                        type="button"
                        onClick={() => setView({ mode: "edit", initial: null })}
                        className="inline-flex items-center gap-1.5 rounded border border-line bg-surface px-3 py-2 text-sm text-ink hover:bg-paper"
                    >
                        <Plus size={14} /> Blank
                    </button>
                    <button
                        type="button"
                        onClick={() => setView({ mode: "chat" })}
                        className="inline-flex items-center gap-1.5 rounded bg-clinical-500 px-3 py-2 text-sm text-paper hover:bg-clinical-600"
                    >
                        <Sparkles size={14} /> Create with AI
                    </button>
                </div>
            </div>
            <div className="mb-4 flex items-center gap-5 border-b border-line">
                {[
                    ["library", "Library"],
                    ["mine", `My templates${ownCount ? ` (${ownCount})` : ""}`],
                ].map(([k, label]) => (
                    <button
                        key={k}
                        type="button"
                        onClick={() => setTab(k)}
                        className={`-mb-px border-b-2 pb-2.5 text-sm ${
                            tab === k ? "border-clinical-500 font-medium text-clinical-600" : "border-transparent text-muted hover:text-ink"
                        }`}
                    >
                        {label}
                    </button>
                ))}
                <input
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    placeholder="Filter"
                    className="mb-1.5 ml-auto w-32 rounded border border-line bg-surface px-2 py-1 text-sm text-ink outline-none focus:border-clinical-500"
                />
            </div>
            {error && <p className="mb-3 text-sm text-alert-500">{error}</p>}
            {!list && !error && (
                <p className="flex items-center gap-2 text-sm text-muted">
                    <Loader2 size={14} className="animate-spin" /> Loading…
                </p>
            )}
            {list && shown.length === 0 && (
                <p className="rounded-md border border-dashed border-line bg-surface px-5 py-6 text-center text-sm text-muted">
                    {tab === "mine"
                        ? "No templates of your own yet. Add one from the library, or create one with AI."
                        : "Nothing matches."}
                </p>
            )}
            <ul className="space-y-2.5">
                {shown.map((t) => (
                    <li key={t.id} className="rounded-md border border-line bg-surface px-4 py-3 shadow-panel">
                        <div className="flex items-start justify-between gap-3">
                            <button type="button" onClick={() => setPreview(t)} className="min-w-0 text-left">
                                <p className="text-base text-ink hover:underline">{t.name}</p>
                                <p className="text-xs text-muted">
                                    {[t.specialty, KIND[t.kind]].filter(Boolean).join(" · ")}
                                </p>
                            </button>
                            {t.isDefault && (
                                <span className="shrink-0 rounded-full border border-clinical-500/30 bg-clinical-50 px-2 py-0.5 text-[11px] text-clinical-600">
                                    Default
                                </span>
                            )}
                        </div>
                        <div className="mt-2.5 flex flex-wrap gap-2">
                            <button type="button" className={btn} onClick={() => setPreview(t)}>
                                Preview
                            </button>
                            {rowActions(t)}
                        </div>
                    </li>
                ))}
            </ul>
            {preview && <PreviewDialog id={preview.id} onClose={() => setPreview(null)} actions={() => rowActions(preview)} />}
            {askDelete && (
                <ConfirmDialog
                    title="Delete template?"
                    message={`"${askDelete.name}" will be removed from your templates. Notes already made with it keep their layout.`}
                    confirmLabel="Delete"
                    destructive
                    onCancel={() => setAskDelete(null)}
                    onConfirm={() => {
                        const t = askDelete;
                        setAskDelete(null);
                        act(`del:${t.id}`, () => deleteTemplate(t.id));
                    }}
                />
            )}
        </div>
    );
}
