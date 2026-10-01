const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

function loadImage(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () =>
            reject(new Error("Couldn't read the letterhead image."));
        img.src = src;
    });
}

// Crop a horizontal band (percent of image height) into a JPEG data URL
function cropBand(img, fromPct, toPct) {
    const sy = Math.round((img.naturalHeight * fromPct) / 100);
    const sh = Math.round((img.naturalHeight * (toPct - fromPct)) / 100);
    if (sh < 2) return null;
    const c = document.createElement("canvas");
    c.width = img.naturalWidth;
    c.height = sh;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(img, 0, sy, img.naturalWidth, sh, 0, 0, c.width, sh);
    return c.toDataURL("image/jpeg", 0.92);
}

// Adds letterhead_header / letterhead_footer (cropped strips) to the doctor object
export async function withLetterheadStrips(doctor) {
    if (!doctor?.letterhead_data) return doctor;
    try {
        const top = clamp(Number(doctor.letterhead_top_pct) || 0, 0, 60);
        const bottom = clamp(
            Number(doctor.letterhead_bottom_pct) || 100,
            40,
            100,
        );
        const img = await loadImage(doctor.letterhead_data);
        return {
            ...doctor,
            letterhead_header: top > 0 ? cropBand(img, 0, top) : null,
            letterhead_footer: bottom < 100 ? cropBand(img, bottom, 100) : null,
        };
    } catch (err) {
        console.log("⚠️ Letterhead skipped:", err.message);
        return { ...doctor, letterhead_header: null, letterhead_footer: null };
    }
}
