import { getDoctorProfile } from "../api/processAudio";

export async function downloadConsultationPdf(result) {
    const [{ generateConsultationPdf }, doctor] = await Promise.all([
        import("./generateConsultationPdf"),
        getDoctorProfile().catch(() => null), // still produce the PDF if the profile can't load
    ]);
    generateConsultationPdf(result, { doctor });
}
