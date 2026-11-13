import React from "react";
import { CheckCircle2, AlertTriangle } from "lucide-react";

// status: "valid" | "none" | "outdated" | "declined" | "withdrawn" | null (loading)
// A small mark beside the patient's name: a green tick when consent is on file, a warning
// sign otherwise. With `hint`, a short line of text says what is missing. With `onClick`,
// the mark is a button (view the consent, or record it).
const LABELS = {
    valid: "Consent on file",
    none: "Consent needed",
    outdated: "Notice updated, re-consent needed",
    declined: "Consent declined",
    withdrawn: "Consent withdrawn",
};
const ACTION = {
    valid: "tap to view",
    none: "tap to record",
    outdated: "tap to re-sign",
    declined: "tap to record again",
    withdrawn: "tap to record again",
};

export default function ConsentBadge({
    status,
    onClick,
    hint = false,
    className = "",
}) {
    if (!status) return null;
    const ok = status === "valid";
    const label = LABELS[status] || LABELS.none;
    const action = ACTION[status] || ACTION.none;
    const icon = ok ? (
        <CheckCircle2
            size={16}
            strokeWidth={2.25}
            className="shrink-0 text-ok-500"
            aria-hidden="true"
        />
    ) : (
        <AlertTriangle
            size={16}
            strokeWidth={2.25}
            className="shrink-0 text-amber-600"
            aria-hidden="true"
        />
    );
    // Text only for missing consent; a tick on its own is enough when all is well
    const text =
        hint && !ok ? (
            <span className="text-xs font-medium text-amber-700">
                {label}
                {onClick ? (
                    <span className="font-normal underline underline-offset-2">
                        {" "}
                        · {action}
                    </span>
                ) : null}
            </span>
        ) : null;
    const title = onClick
        ? `${label}. ${action[0].toUpperCase()}${action.slice(1)}.`
        : label;

    if (onClick)
        return (
            <button
                type="button"
                onClick={onClick}
                title={title}
                aria-label={title}
                className={`inline-flex items-center gap-1 rounded px-0.5 text-left hover:bg-ink/5 ${className}`}
            >
                {icon}
                {text}
            </button>
        );
    return (
        <span
            title={title}
            {...(text ? {} : { role: "img", "aria-label": title })}
            className={`inline-flex items-center gap-1 ${className}`}
        >
            {icon}
            {text}
        </span>
    );
}
