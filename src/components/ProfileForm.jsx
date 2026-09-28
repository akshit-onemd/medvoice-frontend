import React, { useEffect, useRef, useState } from "react";
import { saveDoctorProfile } from "../api/processAudio";

const CANVAS_W = 600;
const CANVAS_H = 200;
const MAX_UPLOAD_W = 500;
const MAX_LEN = 450000;

const inputCls =
    "w-full rounded border border-line bg-paper px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-clinical-500 outline-none";

// Crop a transparent drawing canvas to just the ink
function trimCanvas(src) {
    const { width, height } = src;
    const data = src.getContext("2d").getImageData(0, 0, width, height).data;
    let minX = width,
        minY = height,
        maxX = -1,
        maxY = -1;
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            if (data[(y * width + x) * 4 + 3] > 0) {
                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
                if (y < minY) minY = y;
                if (y > maxY) maxY = y;
            }
        }
    }
    if (maxX < 0) return null;
    const pad = 6;
    minX = Math.max(0, minX - pad);
    minY = Math.max(0, minY - pad);
    maxX = Math.min(width - 1, maxX + pad);
    maxY = Math.min(height - 1, maxY + pad);
    const w = maxX - minX + 1;
    const h = maxY - minY + 1;
    const out = document.createElement("canvas");
    out.width = w;
    out.height = h;
    out.getContext("2d").drawImage(src, minX, minY, w, h, 0, 0, w, h);
    return out.toDataURL("image/png");
}

// Downscale an uploaded image so the stored signature stays small
function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
            const scale = Math.min(1, MAX_UPLOAD_W / img.width);
            const c = document.createElement("canvas");
            c.width = Math.round(img.width * scale);
            c.height = Math.round(img.height * scale);
            const ctx = c.getContext("2d");
            const isPng = file.type === "image/png";
            if (!isPng) {
                ctx.fillStyle = "#ffffff";
                ctx.fillRect(0, 0, c.width, c.height);
            }
            ctx.drawImage(img, 0, 0, c.width, c.height);
            URL.revokeObjectURL(url);
            resolve(
                isPng
                    ? c.toDataURL("image/png")
                    : c.toDataURL("image/jpeg", 0.85),
            );
        };
        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error("Couldn't read that image."));
        };
        img.src = url;
    });
}

export default function ProfileForm({
    title = "Doctor profile",
    intro,
    initial,
    onSaved,
    onCancel,
}) {
    const [name, setName] = useState(initial?.name || "");
    const [qualification, setQualification] = useState(
        initial?.qualification || "",
    );
    const [registrationNo, setRegistrationNo] = useState(
        initial?.registration_no || "",
    );
    const [email, setEmail] = useState(initial?.email || "");
    const [clinicName, setClinicName] = useState(initial?.clinic_name || "");
    const [clinicAddress, setClinicAddress] = useState(
        initial?.clinic_address || "",
    );
    const [signature, setSignature] = useState(initial?.signature_data || "");
    const [editingSig, setEditingSig] = useState(!initial?.signature_data);
    const [sigTab, setSigTab] = useState("draw");
    const [hasInk, setHasInk] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    const canvasRef = useRef(null);
    const drawing = useRef(false);
    const last = useRef(null);

    useEffect(() => {
        const c = canvasRef.current;
        if (!c) return;
        const ctx = c.getContext("2d");
        ctx.lineWidth = 3;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.strokeStyle = "#111111";
    }, [editingSig, sigTab]);

    const point = (e) => {
        const c = canvasRef.current;
        const r = c.getBoundingClientRect();
        return {
            x: ((e.clientX - r.left) * c.width) / r.width,
            y: ((e.clientY - r.top) * c.height) / r.height,
        };
    };
    const startDraw = (e) => {
        drawing.current = true;
        canvasRef.current.setPointerCapture(e.pointerId);
        last.current = point(e);
    };
    const moveDraw = (e) => {
        if (!drawing.current) return;
        const ctx = canvasRef.current.getContext("2d");
        const p = point(e);
        ctx.beginPath();
        ctx.moveTo(last.current.x, last.current.y);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
        last.current = p;
        setHasInk(true);
    };
    const endDraw = () => {
        drawing.current = false;
    };
    const clearCanvas = () => {
        const c = canvasRef.current;
        c.getContext("2d").clearRect(0, 0, c.width, c.height);
        setHasInk(false);
    };

    const handleUpload = async (e) => {
        const file = e.target.files?.[0];
        e.target.value = "";
        if (!file) return;
        setError("");
        try {
            const url = await fileToDataUrl(file);
            if (url.length > MAX_LEN) {
                throw new Error(
                    "That image is too large. Use a smaller or cleaner one.",
                );
            }
            setSignature(url);
            setEditingSig(false);
        } catch (err) {
            setError(err.message);
        }
    };

    const handleSave = async () => {
        setError("");
        if (!name.trim()) return setError("Name is required.");

        let sig = signature;
        if (editingSig && sigTab === "draw" && hasInk) {
            const drawn = trimCanvas(canvasRef.current);
            if (drawn) sig = drawn;
        }
        if (!sig)
            return setError("Please add your signature (draw or upload).");
        if (sig.length > MAX_LEN)
            return setError("Signature image is too large.");

        setSaving(true);
        try {
            const saved = await saveDoctorProfile({
                name: name.trim(),
                qualification,
                registration_no: registrationNo,
                email,
                clinic_name: clinicName,
                clinic_address: clinicAddress,
                signature_data: sig,
            });
            onSaved(saved);
        } catch (err) {
            setError(err.message || "Couldn't save your profile.");
        } finally {
            setSaving(false);
        }
    };

    const tabCls = (active) =>
        `pb-2 text-sm border-b-2 transition-colors ${
            active
                ? "border-clinical-500 text-clinical-600 font-medium"
                : "border-transparent text-muted hover:text-ink"
        }`;

    return (
        <div className="w-full max-w-2xl mx-auto">
            <div className="bg-surface border border-line rounded-md shadow-panel p-6">
                <h2 className="font-serif text-xl text-ink">{title}</h2>
                {intro && <p className="text-sm text-muted mt-1">{intro}</p>}

                <div className="mt-5 space-y-4">
                    <div>
                        <label className="block text-sm text-ink mb-1">
                            Full name <span className="text-alert-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className={inputCls}
                        />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm text-ink mb-1">
                                Qualification
                            </label>
                            <input
                                type="text"
                                value={qualification}
                                onChange={(e) =>
                                    setQualification(e.target.value)
                                }
                                className={inputCls}
                            />
                        </div>
                        <div>
                            <label className="block text-sm text-ink mb-1">
                                Registration number
                            </label>
                            <input
                                type="text"
                                value={registrationNo}
                                onChange={(e) =>
                                    setRegistrationNo(e.target.value)
                                }
                                className={inputCls}
                            />
                        </div>
                        <div>
                            <label className="block text-sm text-ink mb-1">
                                Email
                            </label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className={inputCls}
                            />
                        </div>
                        <div>
                            <label className="block text-sm text-ink mb-1">
                                Clinic / hospital name
                            </label>
                            <input
                                type="text"
                                value={clinicName}
                                onChange={(e) => setClinicName(e.target.value)}
                                className={inputCls}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm text-ink mb-1">
                            Clinic address
                        </label>
                        <input
                            type="text"
                            value={clinicAddress}
                            onChange={(e) => setClinicAddress(e.target.value)}
                            className={inputCls}
                        />
                    </div>

                    <div>
                        <p className="text-sm text-ink mb-2">
                            Signature <span className="text-alert-500">*</span>
                        </p>

                        {!editingSig && signature ? (
                            <div className="flex items-center gap-4 rounded border border-line bg-paper p-3">
                                <img
                                    src={signature}
                                    alt="Your signature"
                                    className="h-16 max-w-[240px] object-contain rounded bg-white"
                                />
                                <button
                                    type="button"
                                    onClick={() => {
                                        setEditingSig(true);
                                        setSigTab("draw");
                                        setHasInk(false);
                                    }}
                                    className="ml-auto text-xs text-clinical-600 underline underline-offset-2"
                                >
                                    Change
                                </button>
                            </div>
                        ) : (
                            <div>
                                <div className="flex gap-5 border-b border-line mb-3">
                                    <button
                                        type="button"
                                        onClick={() => setSigTab("draw")}
                                        className={tabCls(sigTab === "draw")}
                                    >
                                        Draw
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setSigTab("upload")}
                                        className={tabCls(sigTab === "upload")}
                                    >
                                        Upload image
                                    </button>
                                </div>

                                {sigTab === "draw" ? (
                                    <div>
                                        <div className="rounded border border-line bg-white">
                                            <canvas
                                                ref={canvasRef}
                                                width={CANVAS_W}
                                                height={CANVAS_H}
                                                className="w-full h-auto cursor-crosshair"
                                                style={{ touchAction: "none" }}
                                                onPointerDown={startDraw}
                                                onPointerMove={moveDraw}
                                                onPointerUp={endDraw}
                                                onPointerCancel={endDraw}
                                            />
                                        </div>
                                        <div className="flex items-center gap-4 mt-2">
                                            <p className="text-xs text-muted">
                                                Sign above with your finger or
                                                mouse.
                                            </p>
                                            <button
                                                type="button"
                                                onClick={clearCanvas}
                                                className="ml-auto text-xs text-clinical-600 underline underline-offset-2"
                                            >
                                                Clear
                                            </button>
                                            {signature && (
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        setEditingSig(false)
                                                    }
                                                    className="text-xs text-muted underline underline-offset-2"
                                                >
                                                    Keep current
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    <div>
                                        <label className="flex items-center justify-center gap-2 rounded border border-dashed border-line px-4 py-6 text-sm text-clinical-600 cursor-pointer hover:bg-paper">
                                            Choose a PNG or JPEG of your
                                            signature
                                            <input
                                                type="file"
                                                accept="image/png,image/jpeg"
                                                className="hidden"
                                                onChange={handleUpload}
                                            />
                                        </label>
                                        <p className="text-xs text-muted mt-2">
                                            A dark signature on a white or
                                            transparent background works best.
                                        </p>
                                        {signature && (
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setEditingSig(false)
                                                }
                                                className="mt-2 text-xs text-muted underline underline-offset-2"
                                            >
                                                Keep current
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {error && (
                    <p className="mt-4 text-sm text-alert-500">{error}</p>
                )}

                <div className="mt-6 flex gap-3">
                    {onCancel && (
                        <button
                            type="button"
                            onClick={onCancel}
                            disabled={saving}
                            className="rounded border border-line bg-surface px-5 py-3 text-base text-ink hover:bg-paper disabled:opacity-40"
                        >
                            Cancel
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={saving}
                        className="flex-1 rounded bg-clinical-500 text-paper py-3 text-base font-medium hover:bg-clinical-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                        {saving ? "Saving…" : "Save profile"}
                    </button>
                </div>
            </div>
        </div>
    );
}
