import { useEffect, useId, useSyncExternalStore } from "react";

const flags = new Set();
const listeners = new Set();
const emit = () => listeners.forEach((l) => l());

function setFlag(id, on) {
    const had = flags.has(id);
    if (on === had) return;
    if (on) flags.add(id);
    else flags.delete(id);
    emit();
}

const subscribe = (cb) => {
    listeners.add(cb);
    return () => listeners.delete(cb);
};

export const isAnyDirty = () => flags.size > 0; // for event handlers
export const useAnyDirty = () =>
    useSyncExternalStore(subscribe, isAnyDirty, () => false);

export function useDirtyFlag(isDirty) {
    const id = useId();
    useEffect(() => () => setFlag(id, false), [id]); // cleared when the form goes away
    useEffect(() => {
        setFlag(id, !!isDirty);
    }, [id, isDirty]);
}
