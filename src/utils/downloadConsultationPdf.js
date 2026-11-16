import { getDoctorProfile, getTemplateVersion } from "../api/processAudio";
import { noteHasContent, EMPTY_NOTE_MESSAGE } from "./noteContent";
import { withLetterheadStrips } from "./letterheadStrips";

export async function downloadConsultationPdf(result) {
    // Never print a blank prescription
    if (!noteHasContent(result?.structured_data)) throw new Error(EMPTY_NOTE_MESSAGE);
    const ref = result?.structured_data?.template;
    const hasCustom =
        ref?.id && Object.keys(result?.structured_data?.custom || {}).length > 0;
    const [{ generateConsultationPdf }, profile, tpl] = await Promise.all([
        import("./generateConsultationPdf"),
        getDoctorProfile().catch(() => null), // still produce the PDF if the profile can't load
        // The template's own sections need their titles and fields
        hasCustom ? getTemplateVersion(ref.id, ref.version).catch(() => null) : null,
    ]);
    const doctor = await withLetterheadStrips(profile);
    generateConsultationPdf(result, { doctor, template: tpl?.definition || null });
}
