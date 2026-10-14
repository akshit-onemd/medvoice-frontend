import React from "react";
import LetterheadEditor from "./LetterheadEditor";
import { saveBillLetterhead } from "../api/processAudio";

export default function BillLetterheadSettings({ profile, onChange }) {
    const same = profile?.bill_letterhead_same !== false; // default: same
    const hasRx = !!profile?.letterhead_data;

    return (
        <LetterheadEditor
            title="Bill letterhead"
            description="Letterhead for bills. Same rules as prescriptions: header above the top line, footer below the bottom line."
            profile={profile}
            onChange={onChange}
            fields={{
                image: "bill_letterhead_data",
                top: "bill_letterhead_top_pct",
                bottom: "bill_letterhead_bottom_pct",
            }}
            save={(p) => saveBillLetterhead(p)}
            sample="bill"
            sameAs={{
                value: same,
                label: "Same as prescription letterhead",
                note: hasRx
                    ? "Bills use your prescription letterhead."
                    : "No prescription letterhead yet. Bills print without a letterhead.",
                onToggle: (next) => saveBillLetterhead({ same: next }),
            }}
        />
    );
}
