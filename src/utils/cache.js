import { useEffect, useReducer } from "react";

// Keeps the last answer for each key so a screen can show it at once and refresh it quietly
// ("stale while revalidate"). Lives for the browser tab; nothing is stored on disk.
const store = new Map(); // key -> { data, error, at, promise, subs:Set }

function entry(key) {
    let e = store.get(key);
    if (!e) store.set(key, (e = { data: undefined, error: null, at: 0, promise: null, gen: 0, subs: new Set() }));
    return e;
}
const notify = (e) => e.subs.forEach((f) => f());

// Fetches once even when several screens ask at the same moment
export function revalidate(key, fetcher) {
    const e = entry(key);
    if (e.promise) return e.promise;
    const gen = e.gen; // an answer that arrives after forget() is dropped
    const p = fetcher()
        .then((data) => {
            if (gen === e.gen) {
                e.data = data;
                e.error = null;
                e.at = Date.now();
            }
            return data;
        })
        .catch((err) => {
            if (gen === e.gen && e.data === undefined) e.error = err;
            throw err;
        })
        .finally(() => {
            if (e.promise === p) e.promise = null;
            notify(e);
        });
    e.promise = p;
    return p;
}

export const peek = (key) => store.get(key)?.data;

export function setCached(key, data) {
    const e = entry(key);
    e.data = data;
    e.error = null;
    e.at = Date.now();
    notify(e);
}

// Drops keys that start with the prefix (after something changed on the server)
export function forget(prefix) {
    for (const [k, e] of store) {
        if (k.startsWith(prefix)) {
            e.gen += 1;
            e.data = undefined;
            e.error = null;
            e.at = 0;
            e.promise = null;
            notify(e);
        }
    }
}

// data: the last answer (instantly, if there is one); loading: true only when there is nothing to show yet
export function useCached(key, fetcher, { maxAge = 0 } = {}) {
    const [, rerender] = useReducer((x) => x + 1, 0);
    useEffect(() => {
        if (!key) return undefined;
        const e = entry(key);
        e.subs.add(rerender);
        if (e.data === undefined || Date.now() - e.at > maxAge) revalidate(key, fetcher).catch(() => {});
        return () => e.subs.delete(rerender);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [key]);
    const e = key ? entry(key) : null;
    // Forgotten while on screen (something changed): fetch again
    const gen = e?.gen;
    useEffect(() => {
        if (key && e.data === undefined && !e.promise && !e.error) revalidate(key, fetcher).catch(() => {});
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [key, gen]);
    return {
        data: e?.data,
        error: e?.error,
        loading: !!key && e.data === undefined && !e.error,
        refresh: () => revalidate(key, fetcher),
    };
}
