import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
    X,
    SwitchCamera,
    Zap,
    ZapOff,
    ImagePlus,
    Minus,
    Plus,
    Check,
    Trash2,
    RotateCcw,
    ChevronLeft,
    ChevronRight,
    ArrowLeft,
    ArrowRight,
    Loader2,
} from "lucide-react";

const MAX_PAGES = 20;
const MAX_SIDE = 2000; // longest edge, px
const QUALITY = 0.82;
const MIRROR_PREVIEW = true; // front camera preview looks like a mirror
const MIRROR_SAVED = true; // saved page flipped the same way. Keep false so text reads correctly.
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const uid = () =>
    crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2);
const pad = (n) => String(n).padStart(2, "0");
const stamp = () => {
    const d = new Date();
    return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
};

const cameraError = (err) => {
    if (err?.name === "NotAllowedError")
        return "Camera permission was denied. Allow it in browser settings, or use the gallery button.";
    if (err?.name === "NotFoundError") return "No camera found on this device.";
    if (err?.name === "NotReadableError")
        return "The camera is in use by another app.";
    return "Couldn't start the camera. Use the gallery button instead.";
};

function loadImg(file) {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
            URL.revokeObjectURL(url);
            resolve(img);
        };
        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error("Couldn't read an image"));
        };
        img.src = url;
    });
}

// Crops a source to a JPEG, longest side capped at MAX_SIDE
async function renderBlob(source, sx, sy, sw, sh, flipX = false) {
    const scale = Math.min(1, MAX_SIDE / Math.max(sw, sh));
    const w = Math.round(sw * scale);
    const h = Math.round(sh * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, w, h);
    if (flipX) {
        ctx.translate(w, 0);
        ctx.scale(-1, 1);
    }
    ctx.drawImage(source, sx, sy, sw, sh, 0, 0, w, h);
    const blob = await new Promise((res) =>
        canvas.toBlob(res, "image/jpeg", QUALITY),
    );
    canvas.width = 0;
    canvas.height = 0; // free memory
    return blob ? { blob, w, h } : null;
}

const blobToDataURL = (blob) =>
    new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result);
        r.onerror = reject;
        r.readAsDataURL(blob);
    });

async function buildPdf(pages) {
    const { jsPDF } = await import("jspdf");
    const first = pages[0];
    const doc = new jsPDF({
        unit: "mm",
        format: "a4",
        orientation: first.w > first.h ? "landscape" : "portrait",
    });
    for (let i = 0; i < pages.length; i++) {
        const p = pages[i];
        if (i > 0) doc.addPage("a4", p.w > p.h ? "landscape" : "portrait");
        const pw = doc.internal.pageSize.getWidth();
        const ph = doc.internal.pageSize.getHeight();
        const s = Math.min(pw / p.w, ph / p.h);
        const w = p.w * s;
        const h = p.h * s;
        doc.addImage(
            await blobToDataURL(p.blob),
            "JPEG",
            (pw - w) / 2,
            (ph - h) / 2,
            w,
            h,
        );
    }
    return doc.output("blob");
}

export default function ScanPages({ onClose, onDone, output = "pdf" }) {
    const [pages, setPages] = useState([]);
    const [facing, setFacing] = useState("environment");
    const [visible, setVisible] = useState(!document.hidden);
    const [editIndex, setEditIndex] = useState(null);
    const [retakeId, setRetakeId] = useState(null);
    const [ready, setReady] = useState(false);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");
    const [busy, setBusy] = useState(""); // "" | "import" | "build"
    const [flash, setFlash] = useState(false);
    const [multiCam, setMultiCam] = useState(false);
    const [torchSupported, setTorchSupported] = useState(false);
    const [torchOn, setTorchOn] = useState(false);
    const [zoom, setZoom] = useState(1);
    const [range, setRange] = useState({ min: 1, max: 4, native: false });
    const [attempt, setAttempt] = useState(0);
    const [camKey, setCamKey] = useState(0);
    const pagesRef = useRef([]);
    pagesRef.current = pages;
    const videoRef = useRef(null);
    const streamRef = useRef(null);
    const trackRef = useRef(null);
    const tokenRef = useRef(0);
    const zoomRef = useRef(1);
    const rangeRef = useRef(range);
    const pointers = useRef(new Map());
    const pinch = useRef(null);
    const fileInputRef = useRef(null);
    const stripRef = useRef(null);

    const cameraActive = visible && editIndex === null;

    // ---- lifecycle ----
    useEffect(() => {
        const prev = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.body.style.overflow = prev;
        };
    }, []);

    useEffect(() => {
        const onVis = () => setVisible(!document.hidden);
        document.addEventListener("visibilitychange", onVis);
        return () => document.removeEventListener("visibilitychange", onVis);
    }, []);

    useEffect(
        () => () => pagesRef.current.forEach((p) => URL.revokeObjectURL(p.url)),
        [],
    );

    useEffect(() => {
        stripRef.current?.scrollTo({
            left: stripRef.current.scrollWidth,
            behavior: "smooth",
        });
    }, [pages.length]);

    const stopStream = () => {
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        trackRef.current = null;
        if (videoRef.current) videoRef.current.srcObject = null;
    };

    const startStream = async (mode) => {
        const token = ++tokenRef.current;
        stopStream();
        setReady(false);
        setError("");
        setTorchOn(false);
        setTorchSupported(false);

        if (!navigator.mediaDevices?.getUserMedia) {
            setError("Camera needs HTTPS. Use the gallery button instead.");
            return;
        }
        let stream;
        try {
            stream = await navigator.mediaDevices.getUserMedia({
                audio: false,
                video: {
                    facingMode: { ideal: mode },
                    width: { ideal: 3840 },
                    height: { ideal: 2160 },
                },
            });
        } catch (err) {
            if (token === tokenRef.current) setError(cameraError(err));
            return;
        }
        if (token !== tokenRef.current) {
            stream.getTracks().forEach((t) => t.stop());
            return;
        }
        streamRef.current = stream;
        const track = stream.getVideoTracks()[0];
        trackRef.current = track;

        const caps = track.getCapabilities ? track.getCapabilities() : {};
        setTorchSupported(!!caps.torch);

        let next = { min: 1, max: 4, native: false };
        if (caps.zoom && typeof caps.zoom.max === "number") {
            const min = caps.zoom.min ?? 1;
            const max = Math.min(caps.zoom.max, 8);
            if (max > min) next = { min, max, native: true };
        }
        rangeRef.current = next;
        setRange(next);
        const start = clamp(1, next.min, next.max);
        zoomRef.current = start;
        setZoom(start);
        if (next.native) {
            try {
                await track.applyConstraints({ advanced: [{ zoom: start }] });
            } catch {
                /* keep default zoom */
            }
        }

        navigator.mediaDevices
            .enumerateDevices()
            .then((d) => {
                if (token === tokenRef.current) {
                    setMultiCam(
                        d.filter((x) => x.kind === "videoinput").length > 1,
                    );
                }
            })
            .catch(() => {});

        const video = videoRef.current;
        if (video) {
            video.srcObject = stream;
            try {
                await video.play();
            } catch {
                /* autoplay blocked: tap will start it */
            }
        }
        if (token === tokenRef.current) setReady(true);
    };

    useEffect(() => {
        if (!cameraActive) {
            tokenRef.current++;
            stopStream();
            setReady(false);
            setCamKey((k) => k + 1); // next start gets a new <video>
            return;
        }
        startStream(facing);
        return () => {
            tokenRef.current++;
            stopStream();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [facing, cameraActive, attempt]);
    // ---- controls ----
    const applyZoom = (z) => {
        const r = rangeRef.current;
        const next = clamp(z, r.min, r.max);
        zoomRef.current = next;
        setZoom(next);
        if (r.native) {
            trackRef.current
                ?.applyConstraints({ advanced: [{ zoom: next }] })
                .catch(() => {});
        }
    };

    const toggleTorch = async () => {
        try {
            await trackRef.current.applyConstraints({
                advanced: [{ torch: !torchOn }],
            });
            setTorchOn((v) => !v); // own state: some iOS versions return stale settings
        } catch {
            setNotice("Flashlight isn't available on this camera.");
        }
    };

    const onPointerDown = (e) => {
        pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (pointers.current.size === 2) {
            const [a, b] = [...pointers.current.values()];
            pinch.current = {
                d0: Math.hypot(a.x - b.x, a.y - b.y) || 1,
                z0: zoomRef.current,
            };
        }
    };
    const onPointerMove = (e) => {
        if (!pointers.current.has(e.pointerId)) return;
        pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (pointers.current.size === 2 && pinch.current) {
            const [a, b] = [...pointers.current.values()];
            const d = Math.hypot(a.x - b.x, a.y - b.y);
            applyZoom(pinch.current.z0 * (d / pinch.current.d0));
        }
    };
    const onPointerUp = (e) => {
        pointers.current.delete(e.pointerId);
        if (pointers.current.size < 2) pinch.current = null;
    };

    // ---- pages ----
    const capture = async () => {
        const video = videoRef.current;
        if (!video || !video.videoWidth || busy) return;
        if (!retakeId && pagesRef.current.length >= MAX_PAGES) {
            setNotice(`Page limit is ${MAX_PAGES}.`);
            return;
        }
        const vw = video.videoWidth;
        const vh = video.videoHeight;
        const digital = !rangeRef.current.native && zoomRef.current > 1;
        const z = digital ? zoomRef.current : 1;
        const sw = vw / z;
        const sh = vh / z;

        setFlash(true);
        setTimeout(() => setFlash(false), 120);
        if (navigator.vibrate) navigator.vibrate(15);

        const out = await renderBlob(
            video,
            (vw - sw) / 2,
            (vh - sh) / 2,
            sw,
            sh,
            MIRROR_SAVED && facing === "user",
        );
        if (!out) {
            setError("Couldn't capture the page. Try again.");
            return;
        }
        const page = { id: uid(), url: URL.createObjectURL(out.blob), ...out };
        if (retakeId) {
            setPages((ps) =>
                ps.map((p) => {
                    if (p.id !== retakeId) return p;
                    URL.revokeObjectURL(p.url);
                    return page;
                }),
            );
            setRetakeId(null);
        } else {
            setPages((ps) => [...ps, page]);
        }
        setError("");
        setNotice("");
    };

    const importFiles = async (fileList) => {
        const files = Array.from(fileList || []).filter((f) =>
            f.type.startsWith("image/"),
        );
        if (files.length === 0) {
            setNotice("Choose image files.");
            return;
        }
        setBusy("import");
        setError("");
        setNotice("");
        const room = Math.max(0, MAX_PAGES - pagesRef.current.length);
        const take = files.slice(0, room);
        const added = [];
        let failed = 0;
        for (const f of take) {
            try {
                const img = await loadImg(f);
                const out = await renderBlob(
                    img,
                    0,
                    0,
                    img.naturalWidth,
                    img.naturalHeight,
                );
                if (out)
                    added.push({
                        id: uid(),
                        url: URL.createObjectURL(out.blob),
                        ...out,
                    });
                else failed++;
            } catch {
                failed++;
            }
        }
        setPages((ps) => [...ps, ...added]);
        const notes = [];
        if (files.length > take.length)
            notes.push(`Page limit is ${MAX_PAGES}.`);
        if (failed)
            notes.push(
                `${failed} image${failed === 1 ? "" : "s"} couldn't be read.`,
            );
        setNotice(notes.join(" "));
        setBusy("");
    };

    const move = (i, dir) => {
        const j = i + dir;
        if (j < 0 || j >= pagesRef.current.length) return;
        setPages((ps) => {
            const next = [...ps];
            [next[i], next[j]] = [next[j], next[i]];
            return next;
        });
        setEditIndex(j);
    };

    const removeAt = (i) => {
        const p = pagesRef.current[i];
        if (p) URL.revokeObjectURL(p.url);
        const remaining = pagesRef.current.length - 1;
        setPages((ps) => ps.filter((_, idx) => idx !== i));
        if (remaining <= 0) setEditIndex(null);
        else setEditIndex(Math.min(i, remaining - 1));
    };

    const done = async () => {
        if (pages.length === 0 || busy) return;
        setBusy("build");
        setError("");
        try {
            const ts = stamp();
            let files;
            if (output === "images") {
                files = pages.map(
                    (p, i) =>
                        new File([p.blob], `scan-${ts}-p${pad(i + 1)}.jpg`, {
                            type: "image/jpeg",
                        }),
                );
            } else {
                const blob = await buildPdf(pages);
                files = [
                    new File([blob], `scan-${ts}.pdf`, {
                        type: "application/pdf",
                    }),
                ];
            }
            onDone(files);
        } catch (err) {
            setError(err.message || "Couldn't build the PDF.");
            setBusy("");
        }
    };

    const requestClose = () => {
        if (busy) return;
        const n = pagesRef.current.length;
        if (
            n > 0 &&
            !window.confirm(`Discard ${n} scanned page${n === 1 ? "" : "s"}?`)
        )
            return;
        onClose();
    };

    useEffect(() => {
        const onKey = (e) => {
            if (e.key !== "Escape") return;
            if (editIndex !== null) setEditIndex(null);
            else requestClose();
        };
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [editIndex, busy]);

    const editing = editIndex !== null ? pages[editIndex] : null;
    const retakeNo = retakeId
        ? pages.findIndex((p) => p.id === retakeId) + 1
        : 0;
    const digitalScale = !range.native && zoom > 1 ? zoom : 1;
    const atLimit = !retakeId && pages.length >= MAX_PAGES;

    const iconBtn =
        "inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white transition-colors hover:bg-white/25 disabled:opacity-40";
    const mirror = MIRROR_PREVIEW && facing === "user";
    const videoTransform =
        [
            mirror ? "scaleX(-1)" : "",
            digitalScale > 1 ? `scale(${digitalScale})` : "",
        ]
            .filter(Boolean)
            .join(" ") || undefined;
    return createPortal(
        <div
            className="fixed inset-0 z-[80] flex flex-col bg-black text-white"
            style={{ height: "100dvh" }}
        >
            {/* top bar */}
            <div
                className="absolute inset-x-0 top-0 z-10 flex items-center justify-between bg-gradient-to-b from-black/60 to-transparent px-3 pb-4"
                style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}
            >
                <button
                    type="button"
                    onClick={requestClose}
                    className={iconBtn}
                    aria-label="Cancel scan"
                >
                    <X size={18} strokeWidth={1.75} />
                </button>
                <p className="text-sm">
                    {retakeId
                        ? `Retaking page ${retakeNo}`
                        : pages.length
                          ? `${pages.length} page${pages.length === 1 ? "" : "s"}`
                          : "Scan pages"}
                </p>
                <div className="flex gap-2">
                    {torchSupported && (
                        <button
                            type="button"
                            onClick={toggleTorch}
                            className={`${iconBtn} ${torchOn ? "!bg-yellow-400 !text-black" : ""}`}
                            aria-label={
                                torchOn
                                    ? "Turn flashlight off"
                                    : "Turn flashlight on"
                            }
                        >
                            {torchOn ? <Zap size={18} /> : <ZapOff size={18} />}
                        </button>
                    )}
                    {multiCam && (
                        <button
                            type="button"
                            onClick={() =>
                                setFacing((f) =>
                                    f === "environment"
                                        ? "user"
                                        : "environment",
                                )
                            }
                            className={iconBtn}
                            aria-label="Switch camera"
                        >
                            <SwitchCamera size={18} strokeWidth={1.75} />
                        </button>
                    )}
                </div>
            </div>

            {/* camera area */}
            <div
                className="absolute inset-0 select-none overflow-hidden"
                style={{ touchAction: "none" }}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
                onWheel={(e) =>
                    applyZoom(zoomRef.current * (e.deltaY < 0 ? 1.1 : 0.9))
                }
            >
                <video
                    key={`${facing}-${attempt}-${camKey}`}
                    ref={videoRef}
                    autoPlay
                    muted
                    playsInline
                    className="absolute inset-0 h-full w-full object-contain"
                    style={{ transform: videoTransform }}
                />
                {/* page guide */}
                {/* <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <div
                        className="rounded border-2 border-dashed border-white/40"
                        style={{
                            height: "82%",
                            aspectRatio: "210 / 297",
                            maxWidth: "92%",
                        }}
                    />
                </div> */}

                <div
                    className="pointer-events-none absolute inset-0 bg-white transition-opacity duration-100"
                    style={{ opacity: flash ? 0.7 : 0 }}
                />

                {!ready && !error && (
                    <div
                        role="status"
                        aria-label="Starting camera"
                        className="absolute inset-0 flex items-center justify-center"
                    >
                        <Loader2
                            size={36}
                            strokeWidth={1.75}
                            className="animate-spin text-white/70"
                        />
                    </div>
                )}
                {error && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/80 px-8 text-center">
                        <p className="text-sm text-white/90">{error}</p>
                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={() => setAttempt((n) => n + 1)}
                                className="rounded border border-white/40 px-4 py-2 text-sm hover:bg-white/10"
                            >
                                Try again
                            </button>
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className="rounded bg-white px-4 py-2 text-sm text-black"
                            >
                                Choose photos
                            </button>
                        </div>
                    </div>
                )}

                {ready && range.max > range.min && (
                    <div className="absolute right-3 top-1/2 z-10 flex -translate-y-1/2 flex-col items-center gap-1 rounded-full bg-black/55 px-1 py-2">
                        <button
                            type="button"
                            onClick={() => applyZoom(zoomRef.current + 0.5)}
                            disabled={zoom >= range.max}
                            aria-label="Zoom in"
                            className="rounded-full p-1.5 hover:bg-white/15 disabled:opacity-40"
                        >
                            <Plus size={14} strokeWidth={2} />
                        </button>
                        <span className="text-[11px] tabular-nums">
                            {zoom.toFixed(1)}×
                        </span>
                        <button
                            type="button"
                            onClick={() => applyZoom(zoomRef.current - 0.5)}
                            disabled={zoom <= range.min}
                            aria-label="Zoom out"
                            className="rounded-full p-1.5 hover:bg-white/15 disabled:opacity-40"
                        >
                            <Minus size={14} strokeWidth={2} />
                        </button>
                    </div>
                )}

                {busy && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/70">
                        <Loader2 size={28} className="animate-spin" />
                        <p className="text-sm">
                            {busy === "build"
                                ? "Building PDF…"
                                : "Adding photos…"}
                        </p>
                    </div>
                )}
            </div>

            {/* bottom */}
            <div
                className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/75 via-black/40 to-transparent pt-6"
                style={{
                    paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))",
                }}
            >
                {(notice || retakeId) && (
                    <div className="flex items-center justify-center gap-3 px-3 pt-2 text-xs text-white/80">
                        {notice && <span>{notice}</span>}
                        {retakeId && (
                            <button
                                type="button"
                                onClick={() => setRetakeId(null)}
                                className="underline underline-offset-2"
                            >
                                Cancel retake
                            </button>
                        )}
                    </div>
                )}

                <div
                    ref={stripRef}
                    className="flex gap-2 overflow-x-auto px-3 py-2"
                >
                    {pages.length === 0 && (
                        <p className="py-4 text-xs text-white/50">
                            Pages appear here
                        </p>
                    )}
                    {pages.map((p, i) => (
                        <button
                            key={p.id}
                            type="button"
                            onClick={() => setEditIndex(i)}
                            aria-label={`Open page ${i + 1}`}
                            className={`relative h-16 w-12 shrink-0 overflow-hidden rounded border ${
                                p.id === retakeId
                                    ? "border-yellow-400"
                                    : "border-white/40"
                            }`}
                        >
                            <img
                                src={p.url}
                                alt=""
                                className="h-full w-full object-cover"
                            />
                            <span className="absolute bottom-0 right-0 rounded-tl bg-black/70 px-1 text-[10px]">
                                {i + 1}
                            </span>
                        </button>
                    ))}
                </div>

                <div className="grid grid-cols-3 items-center px-4 pt-1">
                    <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={!!busy || atLimit}
                        className="inline-flex items-center gap-2 justify-self-start rounded-full bg-white/15 px-3.5 py-2.5 text-sm hover:bg-white/25 disabled:opacity-40"
                    >
                        <ImagePlus size={16} strokeWidth={1.75} />
                        <span className="hidden sm:inline">Gallery</span>
                    </button>

                    <button
                        type="button"
                        onClick={capture}
                        disabled={!ready || !!busy || atLimit}
                        aria-label="Capture page"
                        className="flex h-[72px] w-[72px] items-center justify-center justify-self-center rounded-full border-4 border-white transition-transform active:scale-95 disabled:opacity-40"
                    >
                        <span className="h-14 w-14 rounded-full bg-white" />
                    </button>

                    <button
                        type="button"
                        onClick={done}
                        disabled={pages.length === 0 || !!busy}
                        className="inline-flex items-center gap-2 justify-self-end rounded-full bg-clinical-500 px-4 py-2.5 text-sm font-medium text-paper hover:bg-clinical-600 disabled:opacity-40"
                    >
                        <Check size={16} strokeWidth={2} />
                        Done
                    </button>
                </div>

                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                        importFiles(e.target.files);
                        e.target.value = "";
                    }}
                />
            </div>

            {/* page editor */}
            {editing && (
                <div
                    className="fixed inset-0 z-[90] bg-black"
                    style={{ height: "100dvh" }}
                >
                    <img
                        key={editing.id}
                        src={editing.url}
                        alt={`Page ${editIndex + 1}`}
                        className="absolute inset-0 h-full w-full object-contain"
                        style={{ padding: "4.5rem 0 7.5rem" }}
                    />

                    <div
                        className="absolute inset-x-0 top-0 z-10 flex items-center justify-between bg-gradient-to-b from-black/60 to-transparent px-3 pb-4"
                        style={{
                            paddingTop:
                                "max(0.75rem, env(safe-area-inset-top))",
                        }}
                    >
                        <button
                            type="button"
                            onClick={() => setEditIndex(null)}
                            className={iconBtn}
                            aria-label="Back to camera"
                        >
                            <X size={18} strokeWidth={1.75} />
                        </button>
                        <p className="text-sm">
                            Page {editIndex + 1} of {pages.length}
                        </p>
                        <span className="w-10" />
                    </div>

                    {editIndex > 0 && (
                        <button
                            type="button"
                            onClick={() => setEditIndex(editIndex - 1)}
                            aria-label="Previous page"
                            className={`${iconBtn} absolute left-2 top-1/2 z-10 -translate-y-1/2`}
                        >
                            <ChevronLeft size={20} />
                        </button>
                    )}
                    {editIndex < pages.length - 1 && (
                        <button
                            type="button"
                            onClick={() => setEditIndex(editIndex + 1)}
                            aria-label="Next page"
                            className={`${iconBtn} absolute right-2 top-1/2 z-10 -translate-y-1/2`}
                        >
                            <ChevronRight size={20} />
                        </button>
                    )}

                    <div
                        className="absolute inset-x-0 bottom-0 z-10 grid grid-cols-4 gap-2 bg-gradient-to-t from-black/75 via-black/40 to-transparent px-3 pt-6"
                        style={{
                            paddingBottom:
                                "max(0.75rem, env(safe-area-inset-bottom))",
                        }}
                    >
                        <button
                            type="button"
                            onClick={() => move(editIndex, -1)}
                            disabled={editIndex === 0}
                            className="flex flex-col items-center gap-1 rounded bg-white/10 py-2.5 text-xs hover:bg-white/20 disabled:opacity-40"
                        >
                            <ArrowLeft size={16} />
                            Move left
                        </button>
                        <button
                            type="button"
                            onClick={() => move(editIndex, 1)}
                            disabled={editIndex === pages.length - 1}
                            className="flex flex-col items-center gap-1 rounded bg-white/10 py-2.5 text-xs hover:bg-white/20 disabled:opacity-40"
                        >
                            <ArrowRight size={16} />
                            Move right
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setRetakeId(editing.id);
                                setEditIndex(null);
                            }}
                            className="flex flex-col items-center gap-1 rounded bg-white/10 py-2.5 text-xs hover:bg-white/20"
                        >
                            <RotateCcw size={16} />
                            Retake
                        </button>
                        <button
                            type="button"
                            onClick={() => removeAt(editIndex)}
                            className="flex flex-col items-center gap-1 rounded bg-red-600/80 py-2.5 text-xs hover:bg-red-600"
                        >
                            <Trash2 size={16} />
                            Delete
                        </button>
                    </div>
                </div>
            )}
        </div>,
        document.body,
    );
}
