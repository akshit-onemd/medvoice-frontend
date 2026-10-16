import React, {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import { Pause, Play, X } from "lucide-react";

const RATES = [1, 1.5, 2];
const BAR_W = 3;
const GAP = 2;
const KNOB = 14;

const fmt = (s) => {
    const t = Math.floor(Number.isFinite(s) && s > 0 ? s : 0);
    const h = Math.floor(t / 3600);
    const m = Math.floor((t % 3600) / 60);
    const sec = String(t % 60).padStart(2, "0");
    return h ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
};

// Max-pools stored peaks down to the number of bars that fit
const resample = (peaks, n) => {
    const out = new Array(n).fill(0);
    for (let i = 0; i < n; i++) {
        const a = Math.floor((i * peaks.length) / n);
        const b = Math.max(a + 1, Math.floor(((i + 1) * peaks.length) / n));
        let m = 0;
        for (let j = a; j < b && j < peaks.length; j++)
            if (peaks[j] > m) m = peaks[j];
        out[i] = m;
    }
    return out;
};

function Bars({ data, played }) {
    return (
        <div className="flex h-full items-center justify-between">
            {data.map((v, i) => (
                <span
                    key={i}
                    className={`block flex-none rounded-full ${played ? "bg-clinical-500" : "bg-muted/40"}`}
                    style={{
                        width: BAR_W,
                        height: `${Math.max(10, v * 100)}%`,
                    }}
                />
            ))}
        </div>
    );
}

function Line({ played }) {
    return (
        <div className="flex h-full items-center">
            <div
                className={`h-1 w-full rounded-full ${played ? "bg-clinical-500" : "bg-muted/40"}`}
            />
        </div>
    );
}

export default function AudioPlayer({
    file,
    peaks,
    durationHint = 0,
    label = "",
    onRemove,
}) {
    const audioRef = useRef(null);
    const trackRef = useRef(null);
    const fillRef = useRef(null);
    const knobRef = useRef(null);
    const rafRef = useRef(0);
    const dragRatio = useRef(null);
    const hintRef = useRef(durationHint);
    hintRef.current = durationHint;

    const [url, setUrl] = useState("");
    const [playing, setPlaying] = useState(false);
    const [duration, setDuration] = useState(durationHint || 0);
    const [shown, setShown] = useState(0);
    const [rateIdx, setRateIdx] = useState(0);
    const [barCount, setBarCount] = useState(48);
    const [error, setError] = useState("");

    useEffect(() => {
        const u = URL.createObjectURL(file);
        setUrl(u);
        setPlaying(false);
        setShown(0);
        setError("");
        setDuration(durationHint || 0);
        return () => URL.revokeObjectURL(u);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [file]);

    useEffect(() => {
        if (audioRef.current) audioRef.current.playbackRate = RATES[rateIdx];
    }, [rateIdx, url]);

    // Bars that fit the width
    useEffect(() => {
        const el = trackRef.current;
        if (!el) return;
        const calc = () =>
            setBarCount(
                Math.max(8, Math.floor((el.clientWidth + GAP) / (BAR_W + GAP))),
            );
        calc();
        const ro = new ResizeObserver(calc);
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    const data = useMemo(
        () => (peaks && peaks.length ? resample(peaks, barCount) : null),
        [peaks, barCount],
    );

    const total = () => {
        const a = audioRef.current;
        if (a && Number.isFinite(a.duration) && a.duration > 0)
            return a.duration;
        return hintRef.current || 0;
    };

    const paint = (ratio) => {
        const p = Math.min(1, Math.max(0, ratio));
        if (fillRef.current)
            fillRef.current.style.clipPath = `inset(0 ${(1 - p) * 100}% 0 0)`;
        if (knobRef.current) {
            knobRef.current.style.left = `calc(${KNOB / 2}px + (100% - ${KNOB}px) * ${p})`;
        }
    };

    const refresh = () => {
        const a = audioRef.current;
        if (!a) return;
        const d = total();
        const t =
            dragRatio.current !== null ? dragRatio.current * d : a.currentTime;
        paint(d ? t / d : 0);
        const sec = Math.floor(t);
        setShown((p) => (p === sec ? p : sec));
    };

    useEffect(() => {
        if (!playing) return;
        const tick = () => {
            refresh();
            rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(rafRef.current);
    }, [playing]);

    const onLoadedMetadata = () => {
        const a = audioRef.current;
        if (!a) return;
        if (Number.isFinite(a.duration) && a.duration > 0) {
            setDuration(a.duration);
            return;
        }
        // Chrome WebM recordings carry no length. Jump to the end once so it learns it.
        const restore = () => {
            a.removeEventListener("timeupdate", restore);
            a.currentTime = 0;
            if (Number.isFinite(a.duration) && a.duration > 0)
                setDuration(a.duration);
        };
        a.addEventListener("timeupdate", restore);
        try {
            a.currentTime = 1e101;
        } catch {
            a.removeEventListener("timeupdate", restore);
        }
    };

    const toggle = async () => {
        const a = audioRef.current;
        if (!a) return;
        if (a.paused) {
            try {
                await a.play();
                setError("");
            } catch {
                setError("Couldn't play this audio.");
            }
        } else {
            a.pause();
        }
    };

    const ratioAt = (clientX) => {
        const r = trackRef.current.getBoundingClientRect();
        return Math.min(1, Math.max(0, (clientX - r.left) / r.width));
    };
    const onPointerDown = (e) => {
        if (!total()) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        dragRatio.current = ratioAt(e.clientX);
        refresh();
    };
    const onPointerMove = (e) => {
        if (dragRatio.current === null) return;
        dragRatio.current = ratioAt(e.clientX);
        refresh();
    };
    const onPointerUp = () => {
        if (dragRatio.current === null) return;
        const a = audioRef.current;
        const d = total();
        if (a && d) a.currentTime = dragRatio.current * d;
        dragRatio.current = null;
        refresh();
    };
    const onPointerCancel = () => {
        dragRatio.current = null;
        refresh();
    };

    const onKeyDown = (e) => {
        const a = audioRef.current;
        if (!a) return;
        if (e.key === "ArrowRight") {
            e.preventDefault();
            a.currentTime = Math.min(total(), a.currentTime + 5);
        } else if (e.key === "ArrowLeft") {
            e.preventDefault();
            a.currentTime = Math.max(0, a.currentTime - 5);
        } else if (e.key === " " || e.key === "Enter") {
            e.preventDefault();
            toggle();
        }
    };

    const rate = RATES[rateIdx];
    const shownTotal = total() || duration;

    return (
        <div className="rounded-md border border-line bg-paper p-3">
            {label && (
                <p className="mb-2 truncate text-xs text-muted">{label}</p>
            )}
            <div className="flex items-center gap-3">
                <button
                    type="button"
                    onClick={toggle}
                    aria-label={playing ? "Pause" : "Play"}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-clinical-500 text-paper hover:bg-clinical-600"
                >
                    {playing ? (
                        <Pause size={18} fill="currentColor" strokeWidth={0} />
                    ) : (
                        <Play
                            size={18}
                            fill="currentColor"
                            strokeWidth={0}
                            className="ml-0.5"
                        />
                    )}
                </button>

                <div className="min-w-0 flex-1">
                    <div
                        role="slider"
                        tabIndex={0}
                        aria-label="Seek"
                        aria-valuemin={0}
                        aria-valuemax={Math.round(shownTotal)}
                        aria-valuenow={shown}
                        aria-valuetext={`${fmt(shown)} of ${fmt(shownTotal)}`}
                        onKeyDown={onKeyDown}
                        onPointerDown={onPointerDown}
                        onPointerMove={onPointerMove}
                        onPointerUp={onPointerUp}
                        onPointerCancel={onPointerCancel}
                        className="relative h-10 cursor-pointer select-none outline-none focus-visible:ring-1 focus-visible:ring-clinical-500"
                        style={{ touchAction: "pan-y" }}
                    >
                        <div
                            ref={trackRef}
                            className="absolute inset-y-0"
                            style={{ left: KNOB / 2, right: KNOB / 2 }}
                        >
                            {data ? (
                                <Bars data={data} played={false} />
                            ) : (
                                <Line played={false} />
                            )}
                            <div
                                ref={fillRef}
                                className="absolute inset-0"
                                style={{ clipPath: "inset(0 100% 0 0)" }}
                            >
                                {data ? (
                                    <Bars data={data} played />
                                ) : (
                                    <Line played />
                                )}
                            </div>
                        </div>
                        <div
                            ref={knobRef}
                            className="pointer-events-none absolute top-1/2 rounded-full bg-clinical-500 shadow"
                            style={{
                                width: KNOB,
                                height: KNOB,
                                left: KNOB / 2,
                                transform: "translate(-50%, -50%)",
                            }}
                        />
                    </div>
                    <div className="mt-0.5 flex justify-between text-xs tabular-nums text-muted">
                        <span>{fmt(shown)}</span>
                        <span>{fmt(shownTotal)}</span>
                    </div>
                </div>

                <button
                    type="button"
                    onClick={() => setRateIdx((i) => (i + 1) % RATES.length)}
                    aria-label={`Playback speed ${rate} times`}
                    className="min-w-[3rem] shrink-0 rounded-full bg-ink px-3 py-1.5 text-xs font-medium text-paper"
                >
                    {rate}×
                </button>

                <button
                    type="button"
                    onClick={onRemove}
                    aria-label="Remove audio"
                    className="shrink-0 text-muted hover:text-ink"
                >
                    <X size={16} strokeWidth={1.75} />
                </button>
            </div>
            {error && <p className="mt-2 text-xs text-alert-500">{error}</p>}

            <audio
                ref={audioRef}
                src={url || undefined}
                preload="metadata"
                onLoadedMetadata={onLoadedMetadata}
                onDurationChange={() => {
                    const a = audioRef.current;
                    if (a && Number.isFinite(a.duration) && a.duration > 0)
                        setDuration(a.duration);
                }}
                onPlay={() => setPlaying(true)}
                onPause={() => setPlaying(false)}
                onEnded={() => {
                    setPlaying(false);
                    if (audioRef.current) audioRef.current.currentTime = 0;
                    refresh();
                }}
                onTimeUpdate={() => !playing && refresh()}
                onSeeked={refresh}
            />
        </div>
    );
}
