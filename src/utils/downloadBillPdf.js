import { getDoctorProfile } from "../api/processAudio";
import { withLetterheadStrips } from "./letterheadStrips";

// Bills use the prescription letterhead unless a separate one is chosen
function billDoctor(p) {
    if (!p || p.bill_letterhead_same !== false) return p;
    return {
        ...p,
        letterhead_data: p.bill_letterhead_data,
        letterhead_top_pct: p.bill_letterhead_top_pct,
        letterhead_bottom_pct: p.bill_letterhead_bottom_pct,
    };
}

async function prepare() {
    const [{ generateBillPdf }, profile] = await Promise.all([
        import("./generateBillPdf"),
        getDoctorProfile().catch(() => null),
    ]);
    const doctor = await withLetterheadStrips(billDoctor(profile));
    return { generateBillPdf, doctor };
}

export async function downloadBillPdf(bill) {
    const { generateBillPdf, doctor } = await prepare();
    generateBillPdf(bill, { doctor });
}

export async function printBillPdf(bill) {
    const { generateBillPdf, doctor } = await prepare();
    const { blob } = generateBillPdf(bill, { doctor, mode: "blob" });
    const url = URL.createObjectURL(blob);

    const iframe = document.createElement("iframe");
    iframe.setAttribute("aria-hidden", "true");
    iframe.style.cssText =
        "position:fixed;left:-9999px;top:0;width:1px;height:1px;border:0;";
    document.body.appendChild(iframe);

    try {
        await new Promise((resolve, reject) => {
            iframe.onload = resolve;
            iframe.onerror = () => reject(new Error("load failed"));
            iframe.src = url;
            setTimeout(resolve, 5000); // some browsers never fire onload for PDFs
        });
        await new Promise((r) => setTimeout(r, 400)); // let the PDF viewer render
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
    } catch {
        URL.revokeObjectURL(url);
        iframe.remove();
        throw new Error("Couldn't open print. Use Download instead.");
    }
    setTimeout(() => {
        URL.revokeObjectURL(url);
        iframe.remove();
    }, 60000);
}
