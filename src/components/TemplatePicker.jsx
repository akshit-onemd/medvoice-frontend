import React, { useEffect, useState } from "react";
import { LayoutTemplate } from "lucide-react";
import { listTemplates } from "../api/processAudio";

let cached = null;
export const forgetTemplateList = () => {
    cached = null;
};

// Which template the next note uses. Starts on the doctor's default.
export default function TemplatePicker({ value, onChange, disabled }) {
    const [list, setList] = useState(cached);
    useEffect(() => {
        let off = false;
        listTemplates()
            .then((b) => {
                cached = b.templates || [];
                if (off) return;
                setList(cached);
            })
            .catch(() => {});
        return () => {
            off = true;
        };
    }, []);
    // Pick the default once the list arrives (or if the chosen one disappeared)
    useEffect(() => {
        if (!list?.length) return;
        if (!value || !list.some((t) => t.id === value)) {
            const def = list.find((t) => t.isDefault) || list[0];
            onChange(def.id);
        }
    }, [list, value, onChange]);

    if (!list || list.length < 2) return null;
    const own = list.filter((t) => !t.builtin);
    const lib = list.filter((t) => t.builtin);
    return (
        <label className="mb-4 flex items-center gap-2 text-sm text-ink">
            <LayoutTemplate size={15} strokeWidth={1.75} className="shrink-0 text-muted" />
            <span className="shrink-0 text-muted">Template</span>
            <select
                value={value || ""}
                disabled={disabled}
                onChange={(e) => onChange(e.target.value)}
                className="min-w-0 flex-1 rounded border border-line bg-surface px-3 py-1.5 text-sm text-ink focus:border-clinical-500 outline-none disabled:opacity-50"
            >
                {own.length > 0 && (
                    <optgroup label="My templates">
                        {own.map((t) => (
                            <option key={t.id} value={t.id}>
                                {t.name}
                                {t.isDefault ? " (default)" : ""}
                            </option>
                        ))}
                    </optgroup>
                )}
                <optgroup label="Library">
                    {lib.map((t) => (
                        <option key={t.id} value={t.id}>
                            {t.name}
                            {t.isDefault ? " (default)" : ""}
                        </option>
                    ))}
                </optgroup>
            </select>
        </label>
    );
}
