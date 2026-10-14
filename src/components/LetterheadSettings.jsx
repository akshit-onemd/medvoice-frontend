import React from "react";
import LetterheadEditor from "./LetterheadEditor";
import { saveLetterhead } from "../api/processAudio";

export default function LetterheadSettings({ profile, onChange }) {
    return (
        <LetterheadEditor
            title="Prescription letterhead"
            description="Upload your letterhead as a full A4 portrait image (PNG or JPG). Only the header above the top line and the footer below the bottom line are used. Everything between stays blank."
            profile={profile}
            onChange={onChange}
            fields={{
                image: "letterhead_data",
                top: "letterhead_top_pct",
                bottom: "letterhead_bottom_pct",
            }}
            save={saveLetterhead}
            sample="consultation"
        />
    );
}
