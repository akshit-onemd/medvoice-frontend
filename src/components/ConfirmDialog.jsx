import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

export default function ConfirmDialog({
    title,
    message,
    confirmLabel = "Confirm",
    cancelLabel = "Cancel",
    destructive = false,
    onConfirm,
    onCancel,
}) {
    const cancelRef = useRef(null);

    useEffect(() => {
        const prev = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        cancelRef.current?.focus();
        return () => {
            document.body.style.overflow = prev;
        };
    }, []);

    useEffect(() => {
        const onKey = (e) => {
            if (e.key !== "Escape") return;
            e.stopPropagation(); // close this dialog only, not one behind it
            onCancel();
        };
        document.addEventListener("keydown", onKey, true);
        return () => document.removeEventListener("keydown", onKey, true);
    }, [onCancel]);

    return createPortal(
        <div
            className="fixed inset-0 z-[110] flex items-center justify-center bg-ink/50 p-4"
            onMouseDown={(e) => {
                if (e.target === e.currentTarget) onCancel();
            }}
        >
            <div
                role="alertdialog"
                aria-modal="true"
                aria-labelledby="confirm-title"
                aria-describedby="confirm-message"
                className="w-full max-w-sm rounded-md border border-line bg-surface p-5 shadow-panel"
            >
                <h2 id="confirm-title" className="font-serif text-lg text-ink">
                    {title}
                </h2>
                <p
                    id="confirm-message"
                    className="mt-2 text-sm leading-relaxed text-muted"
                >
                    {message}
                </p>
                <div className="mt-5 flex justify-end gap-3">
                    <button
                        ref={cancelRef}
                        type="button"
                        onClick={onCancel}
                        className="rounded border border-line bg-surface px-5 py-2.5 text-sm text-ink hover:bg-paper"
                    >
                        {cancelLabel}
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        className={`rounded px-5 py-2.5 text-sm font-medium text-paper ${
                            destructive
                                ? "bg-alert-500 hover:opacity-90"
                                : "bg-clinical-500 hover:bg-clinical-600"
                        }`}
                    >
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>,
        document.body,
    );
}
