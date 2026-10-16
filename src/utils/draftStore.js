// IndexedDB storage for unsaved work. Every operation runs in order, so a clear always
// finishes before a later read.
const DB_NAME = "onemd-drafts";
const STORE = "items";
const TTL_MS = 24 * 60 * 60 * 1000;

let uid = null;
let epoch = 0; // bumped on discard so late recording chunks are not saved
let dbPromise = null;
let queue = Promise.resolve();

export const setDraftUser = (id) => {
    uid = id || null;
};

const wrap = (req) =>
    new Promise((resolve, reject) => {
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
const txDone = (tx) =>
    new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
    });

function openDb() {
    if (!dbPromise) {
        dbPromise = new Promise((resolve, reject) => {
            if (typeof indexedDB === "undefined") {
                reject(new Error("IndexedDB unavailable"));
                return;
            }
            const req = indexedDB.open(DB_NAME, 1);
            req.onupgradeneeded = () => req.result.createObjectStore(STORE);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
            req.onblocked = () => reject(new Error("blocked"));
        });
        dbPromise.catch(() => {
            dbPromise = null;
        });
    }
    return dbPromise;
}

function run(fn, fallback) {
    const p = queue.then(async () => fn(await openDb())).catch(() => fallback);
    queue = p.then(
        () => undefined,
        () => undefined,
    );
    return p;
}

const key = (name) => `${uid}:${name}`;
const expired = (rec) => Date.now() - rec.savedAt > TTL_MS;
const rangeFor = (prefix) =>
    IDBKeyRange.bound(key(prefix), `${key(prefix)}\uffff`);

export function saveItem(name, data) {
    if (!uid) return Promise.resolve();
    const k = key(name);
    return run(async (db) => {
        const tx = db.transaction(STORE, "readwrite");
        tx.objectStore(STORE).put({ data, savedAt: Date.now() }, k);
        await txDone(tx);
    });
}

export function loadRecord(name) {
    if (!uid) return Promise.resolve(null);
    const k = key(name);
    return run(async (db) => {
        const rec = await wrap(
            db.transaction(STORE, "readonly").objectStore(STORE).get(k),
        );
        return !rec || expired(rec) ? null : rec;
    }, null);
}

export const loadItem = async (name) => (await loadRecord(name))?.data ?? null;

export function removeItem(name) {
    if (!uid) return Promise.resolve();
    const k = key(name);
    return run(async (db) => {
        const tx = db.transaction(STORE, "readwrite");
        tx.objectStore(STORE).delete(k);
        await txDone(tx);
    });
}

export function removeByPrefix(prefix) {
    if (!uid) return Promise.resolve();
    return run(async (db) => {
        const tx = db.transaction(STORE, "readwrite");
        tx.objectStore(STORE).delete(rangeFor(prefix));
        await txDone(tx);
    });
}

export function listPrefix(prefix) {
    if (!uid) return Promise.resolve([]);
    return run(async (db) => {
        const st = db.transaction(STORE, "readonly").objectStore(STORE);
        const range = rangeFor(prefix);
        const keys = await wrap(st.getAllKeys(range));
        const vals = await wrap(st.getAll(range));
        return keys
            .map((k, i) => ({
                key: k,
                data: vals[i].data,
                savedAt: vals[i].savedAt,
            }))
            .filter((r) => Date.now() - r.savedAt <= TTL_MS);
    }, []);
}

// Everything for the current login
export function clearAllDrafts() {
    epoch++;
    return removeByPrefix("");
}

// Home screen work: patient, files, recording, new-patient form
export function clearHomeDrafts() {
    epoch++;
    return Promise.all([
        removeByPrefix("home:"),
        removeByPrefix("rec:"),
        removeItem("form:new-patient"),
    ]);
}

// Drops expired items for every login. Also asks the browser not to evict our data.
export function purgeExpired() {
    try {
        navigator.storage?.persist?.();
    } catch {
        /* not supported */
    }
    return run(async (db) => {
        const tx = db.transaction(STORE, "readwrite");
        const req = tx.objectStore(STORE).openCursor();
        req.onsuccess = () => {
            const c = req.result;
            if (!c) return;
            if (expired(c.value)) c.delete();
            c.continue();
        };
        await txDone(tx);
    });
}

// ---- files ----
export async function fileToRecord(file) {
    return { buf: await file.arrayBuffer(), type: file.type, name: file.name };
}
export const recordToFile = (r) =>
    new File([r.buf], r.name || "file", { type: r.type });

// ---- recording, saved a chunk at a time ----
export function beginRecordingDraft(meta) {
    return removeByPrefix("rec:").then(() => saveItem("rec:meta", meta));
}

export async function appendRecordingChunk(index, blob) {
    const e = epoch;
    try {
        const buf = await blob.arrayBuffer();
        if (e !== epoch) return; // discarded while reading
        await saveItem(`rec:c:${String(index).padStart(6, "0")}`, {
            buf,
            type: blob.type,
        });
    } catch {
        /* storage full or unavailable */
    }
}

// Rebuilds a recording that a reload cut off
export async function recoverRecording() {
    const metaRec = await loadRecord("rec:meta");
    if (!metaRec) {
        await removeByPrefix("rec:");
        return null;
    }
    const chunks = await listPrefix("rec:c:");
    if (chunks.length === 0) {
        await removeByPrefix("rec:");
        return null;
    }
    const meta = metaRec.data;
    const type = meta.mimeType || chunks[0].data.type || "audio/webm";
    const ext = type.includes("mp4") ? "m4a" : "webm";
    const blob = new Blob(
        chunks.map((c) => c.data.buf),
        { type },
    );
    const last = chunks[chunks.length - 1];
    const seconds = Math.max(
        1,
        (last.savedAt - (meta.startedAt || last.savedAt)) / 1000,
    );
    return {
        file: new File([blob], `consultation-recovered.${ext}`, { type }),
        seconds,
    };
}
