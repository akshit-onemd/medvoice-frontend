import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, Loader2 } from "lucide-react";
import { FaWhatsapp } from "react-icons/fa";
import ConfirmDialog from "./ConfirmDialog";

// Placeholder: asks to confirm, then shows "sent". Nothing is actually sent yet.
export default function ShareWhatsAppButton({
    patientName,
    phone,
    disabled = false,
}) {
    const [asking, setAsking] = useState(false);
    const [sending, setSending] = useState(false);
    const [sent, setSent] = useState(false);

    useEffect(() => {
        if (!sent) return undefined;
        const t = setTimeout(() => setSent(false), 3000);
        return () => clearTimeout(t);
    }, [sent]);

    const who = patientName ? patientName : "the patient";
    const to = phone ? ` ${phone}` : "";

    const send = () => {
        setAsking(false);
        setSending(true);
        setTimeout(() => {
            setSending(false);
            setSent(true);
        }, 800);
    };

    return (
        <>
            {/* Icon only, so the header keeps its layout */}
            <button
                type="button"
                onClick={() => setAsking(true)}
                disabled={disabled || sending}
                aria-label="Share on WhatsApp"
                title={
                    disabled
                        ? "Add details to the note before sharing."
                        : "Share on WhatsApp"
                }
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-line bg-surface hover:bg-paper transition-colors disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-surface"
            >
                {sending ? (
                    <Loader2 size={18} className="animate-spin text-muted" />
                ) : (
                    <FaWhatsapp size={20} className="text-[#25D366]" />
                )}
            </button>
            {asking && (
                <ConfirmDialog
                    title="Share on WhatsApp?"
                    message={`Send this signed Consultation Summary/Prescription to ${who} +91${to} on WhatsApp?`}
                    confirmLabel="Send"
                    onConfirm={send}
                    onCancel={() => setAsking(false)}
                />
            )}
            {sent &&
                createPortal(
                    <div
                        role="status"
                        className="fixed bottom-6 left-1/2 z-[120] flex -translate-x-1/2 items-center gap-2 rounded-lg bg-ink px-4 py-3 text-sm text-paper shadow-panel"
                    >
                        <CheckCircle2
                            size={16}
                            className="shrink-0 text-green-400"
                        />
                        Sent to {who} on WhatsApp
                    </div>,
                    document.body,
                )}
        </>
    );
}
