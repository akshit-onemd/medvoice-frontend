import React, { useState } from "react";
import { useShowCodes, setShowCodes } from "../utils/codePrefs";

// Settings: whether SNOMED, ICD-10 and LOINC codes appear in consultations.
// Codes are still looked up and saved either way, so turning them back on shows them at once.
export default function CodeSettings() {
    const on = useShowCodes();
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");

    const toggle = async () => {
        setBusy(true);
        setError("");
        try {
            await setShowCodes(!on);
        } catch (err) {
            setError(err.message || "Couldn't save the setting.");
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="mt-8">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted">
                Medical codes
            </p>
            <div className="mt-2 flex items-start justify-between gap-4 rounded border border-line bg-surface px-4 py-3">
                <div className="min-w-0">
                    <p id="show-codes-label" className="text-sm text-ink">
                        Show medical codes
                    </p>
                    <p className="mt-0.5 text-xs text-muted">
                        SNOMED CT, ICD-10 and LOINC codes on consultations, and
                        the code review list. Codes are always added in the
                        background, so turning this on later shows them for past
                        visits too.
                    </p>
                </div>
                <button
                    type="button"
                    role="switch"
                    aria-checked={on}
                    aria-labelledby="show-codes-label"
                    disabled={busy}
                    onClick={toggle}
                    className={`relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
                        on ? "bg-clinical-500" : "bg-line"
                    }`}
                >
                    <span
                        className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
                            on ? "translate-x-5" : "translate-x-0.5"
                        }`}
                    />
                </button>
            </div>
            {error && <p className="mt-2 text-xs text-alert-500">{error}</p>}
        </div>
    );
}
