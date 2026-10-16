const MAX_SECONDS = 600; // longer uploads get a plain bar, no waveform
const MAX_UNKNOWN_BYTES = 15 * 1024 * 1024; // when length cannot be read

// Max-pools a list of levels to n values, scaled so the loudest is 1.
// Returns null for silence, so callers fall back to a plain bar.
export function downsample(arr, n = 256) {
    if (!arr || arr.length === 0) return null;
    const out = new Array(n).fill(0);
    const len = arr.length;
    for (let i = 0; i < n; i++) {
        const a = Math.floor((i * len) / n);
        const b = Math.max(a + 1, Math.floor(((i + 1) * len) / n));
        let m = 0;
        for (let j = a; j < b && j < len; j++) if (arr[j] > m) m = arr[j];
        out[i] = m;
    }
    let max = 0;
    for (const v of out) if (v > max) max = v;
    if (max < 0.02) return null;
    return out.map((v) => v / max);
}

function readDuration(file) {
    return new Promise((resolve) => {
        const url = URL.createObjectURL(file);
        const a = new Audio();
        const done = (v) => {
            clearTimeout(timer);
            a.removeAttribute("src");
            a.load();
            URL.revokeObjectURL(url);
            resolve(v);
        };
        const timer = setTimeout(() => done(null), 4000);
        a.preload = "metadata";
        a.onloadedmetadata = () =>
            done(Number.isFinite(a.duration) ? a.duration : null);
        a.onerror = () => done(null);
        a.src = url;
    });
}

// Waveform for an uploaded file. Returns null when it is too long or cannot be read.
export async function decodePeaks(file, n = 256) {
    try {
        const d = await readDuration(file);
        if (d !== null && d > MAX_SECONDS) return null;
        if (d === null && file.size > MAX_UNKNOWN_BYTES) return null;

        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        const buf = await file.arrayBuffer();
        let ctx;
        try {
            ctx = new AC({ sampleRate: 8000 }); // low rate keeps memory small
        } catch {
            ctx = new AC();
        }
        const decoded = await Promise.race([
            new Promise((res, rej) => ctx.decodeAudioData(buf, res, rej)),
            new Promise((_, rej) =>
                setTimeout(() => rej(new Error("timeout")), 20000),
            ),
        ]);
        ctx.close?.().catch(() => {});

        const ch = decoded.getChannelData(0);
        const raw = new Array(n).fill(0);
        const per = ch.length / n;
        const step = Math.max(1, Math.floor(per / 400));
        for (let i = 0; i < n; i++) {
            const start = Math.floor(i * per);
            const end = Math.min(ch.length, Math.floor((i + 1) * per));
            let m = 0;
            for (let j = start; j < end; j += step) {
                const v = Math.abs(ch[j]);
                if (v > m) m = v;
            }
            raw[i] = Math.sqrt(m); // softens, so quiet parts stay visible
        }
        return downsample(raw, n);
    } catch {
        return null;
    }
}
