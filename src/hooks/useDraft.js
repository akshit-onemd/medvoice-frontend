import { useCallback, useEffect, useRef, useState } from "react";
import { loadItem, saveItem, removeItem } from "../utils/draftStore";

// key: storage name. Pass nothing to switch it off.
// snapshot: the form state. isDirty: differs from the saved original.
// apply(data): put a restored draft back into the form.
// baseline: what the form looks like when untouched.
export default function useDraft(key, { snapshot, isDirty, apply, baseline }) {
    const [restored, setRestored] = useState(false);
    const [ready, setReady] = useState(!key);
    const latest = useRef({});
    latest.current = { snapshot, isDirty, apply, baseline };

    useEffect(() => {
        if (!key) return;
        let cancelled = false;
        loadItem(key).then((d) => {
            if (cancelled) return;
            if (d) {
                latest.current.apply(d);
                setRestored(true);
            }
            setReady(true);
        });
        return () => {
            cancelled = true;
        };
    }, [key]);

    const json = JSON.stringify(snapshot);
    useEffect(() => {
        if (!key || !ready) return;
        const write = () =>
            latest.current.isDirty
                ? saveItem(key, latest.current.snapshot)
                : removeItem(key);
        let timer = setTimeout(() => {
            timer = null;
            write();
        }, 400);
        // Phones may kill the page without warning. Save as it goes to the background.
        const flush = () => {
            if (!timer) return;
            clearTimeout(timer);
            timer = null;
            write();
        };
        const onHide = () => {
            if (document.visibilityState === "hidden") flush();
        };
        document.addEventListener("visibilitychange", onHide);
        window.addEventListener("pagehide", flush);
        return () => {
            if (timer) clearTimeout(timer);
            document.removeEventListener("visibilitychange", onHide);
            window.removeEventListener("pagehide", flush);
        };
    }, [key, ready, json, isDirty]);

    const discard = useCallback(() => {
        if (key) removeItem(key);
        latest.current.apply(latest.current.baseline);
        setRestored(false);
    }, [key]);
    const clear = useCallback(() => {
        if (key) removeItem(key);
    }, [key]);
    const dismiss = useCallback(() => setRestored(false), []);

    return { restored, discard, clear, dismiss };
}
