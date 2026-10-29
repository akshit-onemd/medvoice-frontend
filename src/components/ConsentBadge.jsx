import React from "react";
import { ShieldCheck, ShieldAlert } from "lucide-react";

// status: "valid" | "none" | "outdated" | "declined" | "withdrawn" | null (loading)
const LABELS = {
    valid: "Consent on file",
    none: "Consent needed",
    outdated: "Re-consent needed",
    declined: "Consent declined",
    withdrawn: "Consent withdrawn",
};

export default function ConsentBadge({ status, className = "" }) {
    if (!status) return null;
    const ok = status === "valid";
    const Icon = ok ? ShieldCheck : ShieldAlert;
    return (
        <span
            className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium ${
                ok
                    ? "border-clinical-500 bg-clinical-50 text-clinical-600"
                    : "border-alert-500 bg-paper text-alert-500"
            } ${className}`}
        >
            <Icon size={12} strokeWidth={2} />
            {LABELS[status] || LABELS.none}
        </span>
    );
}
