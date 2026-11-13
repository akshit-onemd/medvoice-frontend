import { useEffect, useState } from "react";
import { SECTION_TYPES } from "../templates/sectionTypes";
import GENERIC from "../templates/generic";
import { isGeneral } from "../templates/general";
import { getTemplateVersion } from "../api/processAudio";

// What a note shows, from its template: the parts of the Prescription & Plan card and the
// history cards, each in the template's order with the template's titles.
export function layoutFor(def) {
    const d = def && Array.isArray(def.sections) ? def : GENERIC;
    const rx = [];
    const cards = [];
    const types = new Set();
    for (const s of d.sections) {
        // The template's own sections are cards too, kept under custom.<id>
        if (isGeneral(s)) {
            cards.push({ type: s.type, key: `custom.${s.id}`, title: s.title, section: s, general: true });
            continue;
        }
        const t = SECTION_TYPES[s.type];
        if (!t) continue;
        types.add(s.type);
        const title = (s.title || "").trim() || t.title;
        if (t.rx) rx.push({ type: s.type, title });
        else cards.push({ type: s.type, key: t.key, title });
    }
    return { rx, cards, has: (type) => types.has(type) };
}

const cache = new Map(); // "id:version" -> definition

// The definition a saved note was made with. Generic for older notes and while loading.
export function useNoteTemplate(doc) {
    const ref = doc?.template;
    const key = ref?.id && ref?.version ? `${ref.id}:${ref.version}` : "";
    const [def, setDef] = useState(() => (key && cache.get(key)) || GENERIC);
    useEffect(() => {
        if (!key) {
            setDef(GENERIC);
            return;
        }
        if (cache.has(key)) {
            setDef(cache.get(key));
            return;
        }
        let off = false;
        getTemplateVersion(ref.id, ref.version)
            .then((t) => {
                const d = t?.definition;
                if (d && Array.isArray(d.sections)) {
                    cache.set(key, d);
                    if (!off) setDef(d);
                }
            })
            .catch(() => {
                /* keep the generic layout */
            });
        return () => {
            off = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [key]);
    return def;
}
