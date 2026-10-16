import React, { useEffect, useRef } from "react";

const BAR_W = 3;
const GAP = 3;
const STEP = BAR_W + GAP;
const STEP_MS = 70; // a new bar every 70 ms
const MIN_H = 3;

export default function LiveWaveform({ stream, peaksRef, height = 48 }) {
    const wrapRef = useRef(null);
    const canvasRef = useRef(null);

    useEffect(() => {
        const wrap = wrapRef.current;
        const canvas = canvasRef.current;
        if (!wrap || !canvas) return;

        const g = canvas.getContext("2d");
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const reduced = window.matchMedia?.(
            "(prefers-reduced-motion: reduce)",
        ).matches;
        const H = height;
        let W = 0;

        const resize = () => {
            W = wrap.clientWidth;
            canvas.width = Math.round(W * dpr);
            canvas.height = Math.round(H * dpr);
            canvas.style.width = `${W}px`;
            canvas.style.height = `${H}px`;
            g.setTransform(dpr, 0, 0, dpr, 0, 0);
        };
        resize();
        const ro = new ResizeObserver(resize);
        ro.observe(wrap);

        // Bars use the wrapper's text color, which is the app green
        const color = getComputedStyle(wrap).color;

        // Mic level via Web Audio. Not routed to speakers.
        let audioCtx = null;
        let analyser = null;
        let source = null;
        let data = null;
        const AC = window.AudioContext || window.webkitAudioContext;
        if (stream && AC) {
            try {
                audioCtx = new AC();
                audioCtx.resume?.().catch(() => {});
                analyser = audioCtx.createAnalyser();
                analyser.fftSize = 512;
                source = audioCtx.createMediaStreamSource(stream);
                source.connect(analyser);
                data = new Uint8Array(analyser.fftSize);
            } catch {
                analyser = null;
            }
        }

        const bars = [];
        let acc = 0;
        let lastPush = performance.now();
        let raf = 0;

        const bar = (x, h) => {
            const y = (H - h) / 2;
            g.beginPath();
            if (g.roundRect) g.roundRect(x, y, BAR_W, h, BAR_W / 2);
            else g.rect(x, y, BAR_W, h);
            g.fill();
        };

        const draw = (now) => {
            raf = requestAnimationFrame(draw);

            let rms = 0;
            if (analyser) {
                analyser.getByteTimeDomainData(data);
                let sum = 0;
                for (let i = 0; i < data.length; i++) {
                    const x = (data[i] - 128) / 128;
                    sum += x * x;
                }
                rms = Math.sqrt(sum / data.length);
            }
            const lvl = Math.pow(Math.min(1, rms * 5), 0.7);
            if (lvl > acc) acc = lvl;

            if (now - lastPush >= STEP_MS) {
                bars.push(acc);
                peaksRef?.current.push(acc); // kept for the replay waveform
                acc = 0;
                lastPush =
                    now - lastPush > STEP_MS * 4 ? now : lastPush + STEP_MS;
                if (bars.length > 1200) bars.splice(0, 600);
            }

            const progress = reduced
                ? 0
                : Math.min(1, (now - lastPush) / STEP_MS);
            g.clearRect(0, 0, W, H);
            g.fillStyle = color;
            const n = Math.ceil(W / STEP) + 2;
            for (let k = 0; k < n; k++) {
                const x = W - BAR_W - k * STEP - progress * STEP; // newest at the right, sliding left
                if (x + BAR_W < 0) break;
                const idx = bars.length - 1 - k;
                const v = idx >= 0 ? bars[idx] : 0;
                bar(x, Math.max(MIN_H, v * (H - 4)));
            }
        };
        raf = requestAnimationFrame(draw);

        return () => {
            cancelAnimationFrame(raf);
            ro.disconnect();
            try {
                source?.disconnect();
            } catch {
                /* already disconnected */
            }
            audioCtx?.close?.().catch(() => {});
        };
    }, [stream, height, peaksRef]);

    return (
        <div
            ref={wrapRef}
            role="img"
            aria-label="Recording in progress"
            className="w-full text-clinical-500"
            style={{ height }}
        >
            <canvas ref={canvasRef} className="block" />
        </div>
    );
}
