import React, { useEffect, useMemo, useRef, useState } from "react";
import { Check, Search } from "lucide-react";

// Recently used templates, newest first. Kept in this browser only.
const RECENT_KEY = "onemd.recentTemplates";
const RECENT_MAX = 4;
export function recentTemplateIds() {
    try {
        const v = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
        return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
    } catch {
        return [];
    }
}
export function rememberTemplate(id) {
    if (!id) return;
    try {
        const next = [id, ...recentTemplateIds().filter((x) => x !== id)].slice(0, 10);
        localStorage.setItem(RECENT_KEY, JSON.stringify(next));
    } catch {
        /* storage blocked: recents just won't show */
    }
}

const KIND = { new: "New patient", follow_up: "Follow-up", condition: "Condition" };
const metaOf = (t) =>
    [t.builtin ? t.specialty || "Library" : "My template", KIND[t.kind]].filter(Boolean).join(" · ");
const norm = (s) => String(s || "").toLowerCase();

// Search box + grouped list of templates. Recent and default first when nothing is typed.
// Keyboard: arrows move, Enter picks, Esc calls onEscape.
// fill: take the parent's full height (in a popup), the list scrolling below the search box
export default function TemplateSearchList({ list, value, currentId, onPick, onEscape, autoFocus = true, maxHeight = "18rem", fill = false }) {
    const [q, setQ] = useState("");
    const [active, setActive] = useState(0);
    const inputRef = useRef(null);
    const listRef = useRef(null);
    useEffect(() => {
        if (autoFocus) inputRef.current?.focus();
    }, [autoFocus]);

    const groups = useMemo(() => {
        const all = list || [];
        const words = norm(q).split(/\s+/).filter(Boolean);
        if (words.length) {
            const hits = all.filter((t) => {
                const hay = norm(`${t.name} ${t.specialty || ""} ${KIND[t.kind] || ""} ${t.builtin ? "library" : "my"}`);
                return words.every((w) => hay.includes(w));
            });
            // Names starting with what was typed come first
            hits.sort((a, b) => norm(b.name).startsWith(words[0]) - norm(a.name).startsWith(words[0]));
            return [{ label: hits.length ? "Results" : "", items: hits }];
        }
        const byId = new Map(all.map((t) => [t.id, t]));
        const recent = recentTemplateIds()
            .map((id) => byId.get(id))
            .filter(Boolean)
            .slice(0, RECENT_MAX);
        const def = all.find((t) => t.isDefault);
        const top = [...recent];
        if (def && !top.includes(def)) top.push(def);
        const used = new Set(top.map((t) => t.id));
        return [
            { label: recent.length ? "Recent" : "Default", items: top },
            { label: "My templates", items: all.filter((t) => !t.builtin && !used.has(t.id)) },
            { label: "Library", items: all.filter((t) => t.builtin && !used.has(t.id)) },
        ].filter((g) => g.items.length);
    }, [list, q]);
    const flat = useMemo(() => groups.flatMap((g) => g.items), [groups]);

    // Start on the chosen template when the list opens, otherwise on the first result
    useEffect(() => {
        const i = q ? 0 : flat.findIndex((t) => t.id === value);
        setActive(i >= 0 ? i : 0);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [q, list]);
    useEffect(() => {
        listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView?.({ block: "nearest" });
    }, [active]);

    const onKey = (e) => {
        if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((i) => Math.min(i + 1, flat.length - 1));
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((i) => Math.max(i - 1, 0));
        } else if (e.key === "Enter") {
            e.preventDefault();
            if (flat[active]) onPick(flat[active]);
        } else if (e.key === "Escape" && onEscape) {
            e.preventDefault();
            e.stopPropagation();
            onEscape();
        }
    };

    let index = -1;
    return (
        <div className={fill ? "flex h-full min-h-0 flex-col" : ""}>
            <div className="relative shrink-0">
                <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <input
                    ref={inputRef}
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    onKeyDown={onKey}
                    placeholder="Search templates"
                    role="combobox"
                    aria-expanded="true"
                    aria-controls="template-options"
                    aria-activedescendant={flat[active] ? `template-opt-${flat[active].id}` : undefined}
                    className="w-full rounded border border-line bg-surface py-2 pl-8 pr-3 text-sm text-ink placeholder:text-muted outline-none focus:border-clinical-500"
                />
            </div>
            <div
                ref={listRef}
                id="template-options"
                role="listbox"
                className={`mt-2 overflow-y-auto ${fill ? "min-h-0 flex-1" : ""}`}
                style={fill ? undefined : { maxHeight }}
            >
                {list && !flat.length && <p className="px-2 py-3 text-sm text-muted">No template matches “{q}”.</p>}
                {groups.map((g) => (
                    <div key={g.label || "results"} className="mb-1.5">
                        {g.label && (
                            <p className="px-2 pb-1 pt-1.5 text-[11px] font-medium uppercase tracking-wide text-muted">{g.label}</p>
                        )}
                        {g.items.map((t) => {
                            index += 1;
                            const i = index;
                            const on = i === active;
                            return (
                                <button
                                    key={`${g.label}-${t.id}`}
                                    id={`template-opt-${t.id}`}
                                    type="button"
                                    role="option"
                                    aria-selected={t.id === value}
                                    data-index={i}
                                    onMouseEnter={() => setActive(i)}
                                    onMouseDown={(e) => e.preventDefault()} // keep focus in the search box
                                    onClick={() => onPick(t)}
                                    className={`flex w-full items-center justify-between gap-3 rounded px-2 py-1.5 text-left transition-colors ${
                                        on ? "bg-clinical-50" : ""
                                    }`}
                                >
                                    <span className="min-w-0">
                                        <span className="block truncate text-sm text-ink">
                                            {t.name}
                                            {t.isDefault && <span className="ml-1.5 text-[11px] text-clinical-600">Default</span>}
                                            {t.id === currentId && <span className="ml-1.5 text-[11px] text-muted">Current</span>}
                                        </span>
                                        <span className="block truncate text-xs text-muted">{metaOf(t)}</span>
                                    </span>
                                    {t.id === value && <Check size={14} className="shrink-0 text-clinical-600" />}
                                </button>
                            );
                        })}
                    </div>
                ))}
            </div>
        </div>
    );
}
