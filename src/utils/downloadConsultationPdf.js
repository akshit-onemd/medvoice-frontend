import { getDoctorProfile } from "../api/processAudio";
import { withLetterheadStrips } from "./letterheadStrips";

export async function downloadConsultationPdf(result) {
    const [{ generateConsultationPdf }, profile] = await Promise.all([
        import("./generateConsultationPdf"),
        getDoctorProfile().catch(() => null), // still produce the PDF if the profile can't load
    ]);
    const doctor = await withLetterheadStrips(profile);
    generateConsultationPdf(result, { doctor });
}
