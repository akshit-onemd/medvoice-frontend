import React, { useEffect, useRef } from "react";
import FluidOrb from "./FluidOrb";

const rgb = (hex) => {
    let h = hex.replace("#", "").trim();
    if (h.length === 3)
        h = h
            .split("")
            .map((c) => c + c)
            .join("");
    const n = parseInt(h, 16);
    if (h.length !== 6 || Number.isNaN(n)) return [26, 115, 242];
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

export default function RecordingOrb({
    stream,
    size = 200,
    color = "#1A73F2",
}) {
    const orbRef = useRef(null);
    const glowRef = useRef(null);

    useEffect(() => {
        const orb = orbRef.current;
        const glow = glowRef.current;
        if (!orb || !glow) return;

        const reduced = window.matchMedia?.(
            "(prefers-reduced-motion: reduce)",
        ).matches;

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

        let raf = 0;
        let level = 0;
        const start = performance.now();

        const tick = (now) => {
            raf = requestAnimationFrame(tick);

            let target = 0;
            if (analyser) {
                analyser.getByteTimeDomainData(data);
                let sum = 0;
                for (let i = 0; i < data.length; i++) {
                    const x = (data[i] - 128) / 128;
                    sum += x * x;
                }
                target = Math.min(1, Math.sqrt(sum / data.length) * 5);
            }
            // Fast attack, slow release
            level += (target - level) * (target > level ? 0.35 : 0.08);

            const t = (now - start) / 1000;
            const lv = reduced ? 0 : level;
            const breathe = reduced ? 0 : 0.012 * Math.sin(t * 2);

            orb.style.transform = `scale(${1 + breathe + lv * 0.16})`;
            glow.style.transform = `scale(${1.12 + lv * 0.32})`;
            glow.style.opacity = String(0.35 + lv * 0.65);
        };
        raf = requestAnimationFrame(tick);

        return () => {
            cancelAnimationFrame(raf);
            try {
                source?.disconnect();
            } catch {
                /* already disconnected */
            }
            audioCtx?.close?.().catch(() => {});
        };
    }, [stream]);

    const [r, g, b] = rgb(color);
    const box = Math.round(size * 1.3);

    return (
        <div
            role="img"
            aria-label="Recording in progress"
            className="relative flex items-center justify-center"
            style={{ width: box, height: box }}
        >
            <div
                ref={glowRef}
                className="absolute rounded-full"
                style={{
                    width: size,
                    height: size,
                    background: `radial-gradient(circle, rgba(${r},${g},${b},0.55) 0%, rgba(${r},${g},${b},0) 70%)`,
                    willChange: "transform, opacity",
                }}
            />
            <div
                ref={orbRef}
                className="relative rounded-full"
                style={{ width: size, height: size, willChange: "transform" }}
            >
                <FluidOrb size={size} color={color} />
            </div>
        </div>
    );
}
