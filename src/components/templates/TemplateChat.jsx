import React, { useEffect, useRef, useState } from "react";
import { Loader2, Send, Sparkles } from "lucide-react";
import { askTemplateBuilder, createTemplate } from "../../api/processAudio";
import TemplateOutline from "./TemplateOutline";
import TryOnVisit from "./TryOnVisit";

const STARTERS = [
    "Diabetes follow-up with HbA1c, home sugar readings and hypo history",
    "Thyroid clinic visit: TSH, free T4, dose and symptoms",
    "Hypertension review with home BP readings and kidney tests",
];

// Make a template by describing it; Gemma drafts it and refines it as you talk
export default function TemplateChat({ onSaved, onEditByHand, onCancel }) {
    const [messages, setMessages] = useState([]);
    const [text, setText] = useState("");
    const [draft, setDraft] = useState(null);
    const [busy, setBusy] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [tab, setTab] = useState("preview");
    const endRef = useRef(null);
    // Braces matter: newer Chrome returns a Promise from scrollIntoView, and an effect must not return one
    useEffect(() => {
        endRef.current?.scrollIntoView({ block: "nearest" });
    }, [messages, busy]);

    const ask = async (next) => {
        setBusy(true);
        setError("");
        try {
            const body = await askTemplateBuilder(next, draft);
            if (body?.template && Array.isArray(body.template.sections)) setDraft(body.template);
            setMessages([...next, { role: "assistant", text: String(body?.reply || "Here is a draft.") }]);
            setTab("preview");
        } catch (err) {
            setError(err?.message || "Couldn't reach the AI. Try again.");
        } finally {
            setBusy(false);
        }
    };
    const send = (say) => {
        const t = String(typeof say === "string" ? say : text).trim();
        if (!t || busy) return;
        const next = [...messages, { role: "user", text: t }];
        setMessages(next);
        setText("");
        ask(next);
    };
    // The last message got no answer: ask again without retyping it
    const retry = () => !busy && messages.at(-1)?.role === "user" && ask(messages);

    const save = async () => {
        setSaving(true);
        setError("");
        try {
            onSaved(await createTemplate(draft));
        } catch (err) {
            setError(err.message || "Couldn't save the template");
            setSaving(false);
        }
    };

    return (
        <div className="grid gap-5 lg:grid-cols-2">
            <div className="flex min-h-[28rem] flex-col rounded-md border border-line bg-surface shadow-panel">
                <div className="flex items-center gap-2 border-b border-line px-5 py-3">
                    <Sparkles size={16} className="text-clinical-600" />
                    <p className="font-display text-base text-ink">Create with AI</p>
                </div>
                <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
                    {messages.length === 0 && (
                        <div className="space-y-2">
                            <p className="text-sm text-muted">
                                Describe the visit this template is for, the sections you want, and anything to leave
                                out. You can keep refining it.
                            </p>
                            {STARTERS.map((s) => (
                                <button
                                    key={s}
                                    type="button"
                                    onClick={() => send(s)}
                                    className="block w-full rounded border border-line bg-paper px-3 py-2 text-left text-sm text-ink hover:bg-clinical-50"
                                >
                                    {s}
                                </button>
                            ))}
                        </div>
                    )}
                    {messages.map((m, i) => (
                        <div
                            key={i}
                            className={`max-w-[85%] rounded-md px-3 py-2 text-sm ${
                                m.role === "user"
                                    ? "ml-auto bg-clinical-500 text-paper"
                                    : "bg-paper text-ink border border-line"
                            }`}
                        >
                            {m.text}
                        </div>
                    ))}
                    {busy && (
                        <p className="flex items-center gap-2 text-sm text-muted">
                            <Loader2 size={14} className="animate-spin" /> Drafting…
                        </p>
                    )}
                    <div ref={endRef} />
                </div>
                {error && (
                    <p className="px-5 pb-2 text-sm text-alert-500">
                        {error}{" "}
                        {messages.at(-1)?.role === "user" && (
                            <button type="button" onClick={retry} className="underline">
                                Try again
                            </button>
                        )}
                    </p>
                )}
                <div className="flex gap-2 border-t border-line p-3">
                    <textarea
                        rows={2}
                        value={text}
                        disabled={busy}
                        onChange={(e) => setText(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                send();
                            }
                        }}
                        placeholder={draft ? "Ask for a change…" : "What is this template for?"}
                        className="flex-1 resize-none rounded border border-line bg-surface px-3 py-2.5 text-sm text-ink outline-none focus:border-clinical-500"
                    />
                    <button
                        type="button"
                        onClick={() => send()}
                        disabled={busy || !text.trim()}
                        aria-label="Send"
                        className="rounded bg-clinical-500 px-3 text-paper hover:bg-clinical-600 disabled:opacity-40"
                    >
                        <Send size={16} />
                    </button>
                </div>
            </div>

            <div className="rounded-md border border-line bg-surface p-5 shadow-panel">
                <div className="mb-3 flex items-center gap-4 border-b border-line">
                    {[
                        ["preview", "Preview"],
                        ["try", "Try on a visit"],
                    ].map(([k, label]) => (
                        <button
                            key={k}
                            type="button"
                            disabled={!draft}
                            onClick={() => setTab(k)}
                            className={`-mb-px border-b-2 pb-2 text-sm disabled:opacity-40 ${
                                tab === k ? "border-clinical-500 text-clinical-600" : "border-transparent text-muted"
                            }`}
                        >
                            {label}
                        </button>
                    ))}
                </div>
                {draft && (
                    <div className="mb-3">
                        <p className="font-display text-lg text-ink">{draft.name}</p>
                        {draft.description && <p className="text-xs text-muted">{draft.description}</p>}
                    </div>
                )}
                {!draft ? (
                    <p className="text-sm text-muted italic">The draft appears here.</p>
                ) : tab === "preview" ? (
                    <TemplateOutline def={draft} />
                ) : (
                    <TryOnVisit def={draft} />
                )}
                <div className="mt-5 flex flex-wrap gap-2">
                    <button type="button" onClick={onCancel} className="rounded border border-line bg-surface px-4 py-2 text-sm text-ink hover:bg-paper">
                        Cancel
                    </button>
                    {draft && (
                        <>
                            <button
                                type="button"
                                onClick={() => onEditByHand(draft)}
                                className="rounded border border-line bg-surface px-4 py-2 text-sm text-ink hover:bg-paper"
                            >
                                Edit by hand
                            </button>
                            <button
                                type="button"
                                onClick={save}
                                disabled={saving || busy}
                                className="flex flex-1 items-center justify-center gap-2 rounded bg-clinical-500 px-4 py-2 text-sm font-medium text-paper hover:bg-clinical-600 disabled:opacity-40"
                            >
                                {saving && <Loader2 size={14} className="animate-spin" />}
                                Save to my templates
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
