import React, { useEffect, useRef, useState } from "react";
import { Eraser } from "lucide-react";

// Draw-to-sign canvas. Calls onChange(pngDataUrl) after each stroke,
// and onChange(null) when cleared.
export default function SignaturePad({ onChange, height = 180 }) {
    const canvasRef = useRef(null);
    const drawing = useRef(false);
    const last = useRef(null);
    const [hasInk, setHasInk] = useState(false);

    const paintBackground = (canvas) => {
        const ctx = canvas.getContext("2d");
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.restore();
    };

    useEffect(() => {
        const canvas = canvasRef.current;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const w = canvas.clientWidth;
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(height * dpr);
        const ctx = canvas.getContext("2d");
        ctx.scale(dpr, dpr);
        ctx.lineWidth = 2.2;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.strokeStyle = "#191919";
        paintBackground(canvas);
    }, [height]);

    const pos = (e) => {
        const r = canvasRef.current.getBoundingClientRect();
        return { x: e.clientX - r.left, y: e.clientY - r.top };
    };

    const down = (e) => {
        e.preventDefault();
        canvasRef.current.setPointerCapture(e.pointerId);
        drawing.current = true;
        last.current = pos(e);
        // dot for a tap
        const ctx = canvasRef.current.getContext("2d");
        ctx.beginPath();
        ctx.arc(last.current.x, last.current.y, 1, 0, Math.PI * 2);
        ctx.fillStyle = "#191919";
        ctx.fill();
    };

    const move = (e) => {
        if (!drawing.current) return;
        e.preventDefault();
        const p = pos(e);
        const ctx = canvasRef.current.getContext("2d");
        ctx.beginPath();
        ctx.moveTo(last.current.x, last.current.y);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
        last.current = p;
    };

    const up = () => {
        if (!drawing.current) return;
        drawing.current = false;
        setHasInk(true);
        onChange?.(canvasRef.current.toDataURL("image/png"));
    };

    const clear = () => {
        paintBackground(canvasRef.current);
        setHasInk(false);
        onChange?.(null);
    };

    return (
        <div>
            <div className="relative rounded border border-line bg-white">
                <canvas
                    ref={canvasRef}
                    style={{ height, touchAction: "none" }}
                    className="w-full block cursor-crosshair"
                    onPointerDown={down}
                    onPointerMove={move}
                    onPointerUp={up}
                    onPointerCancel={up}
                />
                {!hasInk && (
                    <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-muted">
                        Sign here
                    </span>
                )}
            </div>
            <button
                type="button"
                onClick={clear}
                disabled={!hasInk}
                className="mt-2 inline-flex items-center gap-1 text-xs text-clinical-600 underline underline-offset-2 disabled:opacity-40 disabled:no-underline"
            >
                <Eraser size={12} /> Clear
            </button>
        </div>
    );
}
