// Templates are asked for on several screens; keep the list and each definition between visits.
import { forget, peek, revalidate, setCached, useCached } from "../utils/cache";
import { getTemplate, listTemplates } from "./processAudio";

const LIST = "templates:list";
const fetchList = () => listTemplates().then((b) => b.templates || []);

export const useTemplateList = () => useCached(LIST, fetchList);
export const prefetchTemplates = () => revalidate(LIST, fetchList).catch(() => {});
export const refreshTemplates = () => revalidate(LIST, fetchList);

const defKey = (id) => `templates:def:${id}`;
// The current definition of one template; instant when it was opened before
export function loadTemplateDef(id) {
    const hit = peek(defKey(id));
    if (hit) {
        revalidate(defKey(id), () => getTemplate(id)).catch(() => {});
        return Promise.resolve(hit);
    }
    return revalidate(defKey(id), () => getTemplate(id));
}
export const useTemplateDef = (id) => useCached(id ? defKey(id) : null, () => getTemplate(id));

// After a template is created, changed, copied or deleted
export function templatesChanged(id) {
    if (id) forget(defKey(id));
    return refreshTemplates().catch(() => {});
}
// Show a change at once (e.g. a new default) before the server confirms it
export const setTemplateList = (list) => setCached(LIST, list);

// Forget everything (sign-out, tests)
export const forgetTemplates = () => forget("templates:");
export const rememberTemplateDef = (t) => t?.id && setCached(defKey(t.id), t);
