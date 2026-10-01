import React, { useRef, useState } from "react";
import { ImagePlus, Wand2, Trash2, Download } from "lucide-react";
import { saveLetterhead } from "../api/processAudio";
import { withLetterheadStrips } from "../utils/letterheadStrips";
const MAX_LEN = 1100000; // stored data-URL size limit (server allows 1.2M)
const A4_RATIO = 210 / 297;

const SAMPLE = {
    created_at: new Date().toISOString(),
    saved: {
        patient_name: "Sample Patient",
        patient_age: 42,
        patient_gender: "male",
        patient_phone: "9800000000",
    },
    structured_data: {
        conditions: [{ name: "Hypertension", duration: "4 years" }],
        medication_history: [
            { name: "Amlodipine 5 mg", dosage: "1-0-0", status: "Ongoing" },
        ],
        prescription: {
            symptoms: [{ name: "Chest pain", duration: "3 days" }],
            medications: [
                {
                    name: "Aspirin 75 mg",
                    dosage: ["0-0-1"],
                    duration: "30 days",
                    instructions: "After food",
                },
            ],
            diagnosis: [{ name: "Unstable angina" }],
            followup: [
                { next_visit_duration: "5 days", advice: "Bring all reports" },
            ],
        },
    },
};

function loadImage(file) {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
            URL.revokeObjectURL(url);
            resolve(img);
        };
        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error("Couldn't read that image."));
        };
        img.src = url;
    });
}

async function dataUrlToImage(url) {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
}

// Flatten onto white and shrink until it fits the size limit
function compress(img) {
    for (const width of [1240, 1000, 800]) {
        const w = Math.min(width, img.width);
        const c = document.createElement("canvas");
        c.width = w;
        c.height = Math.round(w * (img.height / img.width));
        const ctx = c.getContext("2d");
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, c.width, c.height);
        ctx.drawImage(img, 0, 0, c.width, c.height);
        for (const q of [0.85, 0.7, 0.55]) {
            const url = c.toDataURL("image/jpeg", q);
            if (url.length <= MAX_LEN) return url;
        }
    }
    return null;
}

// Best-effort: find where the header artwork ends and the footer artwork begins.
// Ignores the left 30% of the page so side decoration doesn't confuse it.
function suggestArea(img) {
    const W = 120;
    const H = Math.round(W * (img.height / img.width));
    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, W, H);
    ctx.drawImage(img, 0, 0, W, H);
    const d = ctx.getImageData(0, 0, W, H).data;
    const x0 = Math.round(W * 0.3);
    const inked = [];
    for (let y = 0; y < H; y++) {
        let n = 0;
        for (let x = x0; x < W; x++) {
            const i = (y * W + x) * 4;
            if ((d[i] + d[i + 1] + d[i + 2]) / 3 < 235) n++;
        }
        inked.push(n / (W - x0) > 0.02);
    }
    const gap = Math.max(3, Math.round(H * 0.05));

    let top = 0,
        blank = 0,
        seenTop = false;
    for (let y = 0; y < H * 0.45; y++) {
        if (inked[y]) {
            seenTop = true;
            top = y;
            blank = 0;
        } else if (seenTop && ++blank >= gap) break;
    }
    let bottom = H,
        blank2 = 0,
        seenBottom = false;
    for (let y = H - 1; y > H * 0.55; y--) {
        if (inked[y]) {
            seenBottom = true;
            bottom = y;
            blank2 = 0;
        } else if (seenBottom && ++blank2 >= gap) break;
    }

    const pct = (v) => Math.round((v / H) * 1000) / 10;
    const t = seenTop ? Math.min(60, pct(top + 1)) : 0;
    const b = seenBottom ? Math.max(40, pct(bottom)) : 100;
    return b - t < 30 ? { top: 0, bottom: 100 } : { top: t, bottom: b };
}

export default function LetterheadSettings({ profile, onChange }) {
    const hasSaved = !!profile?.letterhead_data;
    const [image, setImage] = useState(profile?.letterhead_data || "");
    const [top, setTop] = useState(Number(profile?.letterhead_top_pct) || 0);
    const [bottom, setBottom] = useState(
        Number(profile?.letterhead_bottom_pct) || 100,
    );
    const [ratio, setRatio] = useState(null);
    const [busy, setBusy] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");
    const areaRef = useRef(null);

    const handleFile = async (e) => {
        const file = e.target.files?.[0];
        e.target.value = "";
        if (!file) return;
        setError("");
        setNotice("");
        setBusy(true);
        try {
            const img = await loadImage(file);
            const out = compress(img);
            if (!out)
                throw new Error(
                    "That image is too large. Try exporting a smaller one.",
                );
            const area = suggestArea(img);
            setImage(out);
            setTop(area.top);
            setBottom(area.bottom);
            setNotice(
                "Content area detected automatically. Drag the two lines to fine-tune.",
            );
        } catch (err) {
            setError(err.message || "Couldn't process that image.");
        } finally {
            setBusy(false);
        }
    };

    const autoDetect = async () => {
        setError("");
        setNotice("");
        try {
            const area = suggestArea(await dataUrlToImage(image));
            setTop(area.top);
            setBottom(area.bottom);
            setNotice("Detected. Drag the lines to fine-tune.");
        } catch {
            setError("Couldn't analyse that image.");
        }
    };

    const drag = (which) => ({
        onPointerDown: (e) => e.currentTarget.setPointerCapture(e.pointerId),
        onPointerMove: (e) => {
            if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
            const r = areaRef.current.getBoundingClientRect();
            const pct =
                Math.round(((e.clientY - r.top) / r.height) * 1000) / 10;
            if (which === "top")
                setTop(Math.min(Math.max(0, pct), 60, bottom - 30));
            else setBottom(Math.max(Math.min(100, pct), 40, top + 30));
        },
    });

    const handleBar = (pos, label, which) => (
        <div
            {...drag(which)}
            className="absolute inset-x-0 z-10 flex cursor-row-resize items-center"
            style={{
                top: `${pos}%`,
                height: 24,
                marginTop: -12,
                touchAction: "none",
            }}
        >
            <div className="w-full border-t-2 border-dashed border-clinical-500" />
            <span className="absolute right-1 top-0 rounded bg-clinical-500 px-1.5 py-0.5 text-[10px] text-paper">
                {label}
            </span>
        </div>
    );

    const handleSave = async () => {
        setError("");
        setNotice("");
        setSaving(true);
        try {
            const updated = await saveLetterhead({
                image_data: image,
                top_pct: top,
                bottom_pct: bottom,
            });
            onChange(updated);
            setNotice(
                "Letterhead saved. It will be used on every PDF you download.",
            );
        } catch (err) {
            setError(err.message || "Couldn't save the letterhead.");
        } finally {
            setSaving(false);
        }
    };

    const handleRemove = async () => {
        setError("");
        setNotice("");
        if (hasSaved) {
            setSaving(true);
            try {
                onChange(await saveLetterhead({ image_data: null }));
            } catch (err) {
                setError(err.message || "Couldn't remove the letterhead.");
                setSaving(false);
                return;
            }
            setSaving(false);
        }
        setImage("");
        setTop(0);
        setBottom(100);
        setRatio(null);
    };

    const downloadSample = async () => {
        setError("");
        try {
            const { generateConsultationPdf } =
                await import("../utils/generateConsultationPdf");
            const doctor = await withLetterheadStrips({
                ...profile,
                letterhead_data: image,
                letterhead_top_pct: top,
                letterhead_bottom_pct: bottom,
            });
            generateConsultationPdf(SAMPLE, { doctor });
        } catch (err) {
            setError(err.message || "Couldn't build the sample PDF.");
        }
    };

    const notA4 = ratio !== null && Math.abs(ratio - A4_RATIO) > 0.06;

    return (
        <div className="bg-surface border border-line rounded-md shadow-panel p-6">
            <h2 className="font-serif text-xl text-ink">
                Prescription letterhead
            </h2>
            <p className="text-sm text-muted mt-1">
                Upload your letterhead as a full A4 portrait image (PNG or JPG).
                Your header and footer stay as designed, and the prescription is
                placed between the two lines you set.
            </p>

            <div className="mt-4 flex flex-wrap items-center gap-3">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded border border-dashed border-line px-4 py-2.5 text-sm text-clinical-600 hover:bg-paper">
                    <ImagePlus size={16} strokeWidth={1.75} />
                    {busy
                        ? "Processing…"
                        : image
                          ? "Replace image"
                          : "Upload letterhead"}
                    <input
                        type="file"
                        accept="image/png,image/jpeg"
                        className="hidden"
                        onChange={handleFile}
                    />
                </label>
                {image && (
                    <>
                        <button
                            type="button"
                            onClick={autoDetect}
                            className="inline-flex items-center gap-1.5 text-sm text-clinical-600 hover:underline"
                        >
                            <Wand2 size={14} strokeWidth={1.75} /> Auto-detect
                            area
                        </button>
                        <button
                            type="button"
                            onClick={handleRemove}
                            disabled={saving}
                            className="ml-auto inline-flex items-center gap-1.5 text-sm text-alert-500 hover:underline disabled:opacity-40"
                        >
                            <Trash2 size={14} strokeWidth={1.75} /> Remove
                        </button>
                    </>
                )}
            </div>

            {image && (
                <div className="mt-5">
                    <div
                        ref={areaRef}
                        className="relative mx-auto w-full max-w-[300px] select-none border border-line bg-white"
                        style={{ aspectRatio: "210 / 297" }}
                    >
                        <img
                            src={image}
                            alt="Letterhead preview"
                            draggable={false}
                            onLoad={(e) =>
                                setRatio(
                                    e.target.naturalWidth /
                                        e.target.naturalHeight,
                                )
                            }
                            className="absolute inset-0 h-full w-full object-fill"
                        />
                        <div
                            className="pointer-events-none absolute inset-x-0 flex items-center justify-center bg-white"
                            style={{
                                top: `${top}%`,
                                bottom: `${100 - bottom}%`,
                            }}
                        >
                            <span className="rounded bg-paper px-2 py-0.5 text-[10px] text-muted">
                                Prescription content
                            </span>
                        </div>
                        {handleBar(top, "Content starts", "top")}
                        {handleBar(bottom, "Content ends", "bottom")}
                    </div>
                    <p className="mt-2 text-center text-xs text-muted">
                        Header takes {top.toFixed(1)}% · footer takes
                        {(100 - bottom).toFixed(1)}% of the page
                    </p>
                    {notA4 && (
                        <p className="mt-1 text-center text-xs text-alert-500">
                            This image isn't A4 portrait, so it will be
                            stretched to fill the page.
                        </p>
                    )}
                </div>
            )}

            {notice && (
                <p className="mt-4 text-sm text-clinical-600">{notice}</p>
            )}
            {error && <p className="mt-4 text-sm text-alert-500">{error}</p>}

            {image && (
                <div className="mt-5 flex gap-3">
                    <button
                        type="button"
                        onClick={downloadSample}
                        className="inline-flex items-center gap-2 rounded border border-line bg-surface px-4 py-2.5 text-sm text-ink hover:bg-paper"
                    >
                        <Download size={14} strokeWidth={1.75} /> Download
                        sample PDF
                    </button>
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={saving}
                        className="flex-1 rounded bg-clinical-500 py-2.5 text-sm font-medium text-paper hover:bg-clinical-600 disabled:opacity-40 transition-colors"
                    >
                        {saving ? "Saving…" : "Save letterhead"}
                    </button>
                </div>
            )}
        </div>
    );
}
