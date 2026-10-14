import React, { useEffect, useRef, useState } from "react";
import { X, Download, Printer, CheckCircle2 } from "lucide-react";
import ConsultationServices from "./ConsultationServices";
import { createBill } from "../api/processAudio";
import { downloadBillPdf, printBillPdf } from "../utils/downloadBillPdf";
import { money } from "../utils/money";

// Phones and tablets: no print option
const isMobile = () => !!window.matchMedia?.("(pointer: coarse)").matches;

export default function BillDialog({ consultationId, onClose }) {
    const [step, setStep] = useState("services"); // services | working | done
    const [bill, setBill] = useState(null);
    const [error, setError] = useState("");
    const [busy, setBusy] = useState("");
    const [notice, setNotice] = useState("");
    const panelRef = useRef(null);
    const mobile = isMobile();
    const locked = !!busy || step === "working";

    useEffect(() => {
        const prev = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        panelRef.current?.focus();
        return () => {
            document.body.style.overflow = prev;
        };
    }, []);

    useEffect(() => {
        const onKey = (e) => {
            if (e.key === "Escape" && !locked) onClose();
        };
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [locked, onClose]);

    const handleSaved = async () => {
        setError("");
        setStep("working");
        try {
            setBill(await createBill(consultationId));
            setStep("done");
        } catch (err) {
            setError(err.message || "Couldn't create the bill");
            setStep("services");
        }
    };

    const run = async (kind) => {
        setBusy(kind);
        setError("");
        setNotice("");
        try {
            if (kind === "print") await printBillPdf(bill);
            else await downloadBillPdf(bill);
            setNotice(
                kind === "print" ? "Print dialog opened." : "Bill downloaded.",
            );
        } catch (err) {
            setError(err.message || "Something went wrong");
        } finally {
            setBusy("");
        }
    };

    return (
        <div
            className="fixed inset-0 z-[60] flex items-end justify-center bg-ink/50 sm:items-center sm:p-4"
            onMouseDown={(e) => {
                if (e.target === e.currentTarget && !locked) onClose();
            }}
        >
            <div
                ref={panelRef}
                tabIndex={-1}
                role="dialog"
                aria-modal="true"
                aria-labelledby="bill-dialog-title"
                className="max-h-[92vh] w-full overflow-y-auto rounded-t-lg border border-line bg-surface p-5 shadow-panel outline-none sm:max-w-lg sm:rounded-md"
            >
                <div className="mb-4 flex items-start justify-between gap-3">
                    <div>
                        <h2
                            id="bill-dialog-title"
                            className="font-serif text-lg text-ink"
                        >
                            {step === "done" ? "Bill ready" : "Create bill"}
                        </h2>
                        {step === "services" && (
                            <p className="text-xs text-muted">
                                Select services for this visit. Tax is added on
                                top.
                            </p>
                        )}
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={locked}
                        aria-label="Close"
                        className="shrink-0 text-muted hover:text-ink disabled:opacity-40"
                    >
                        <X size={18} strokeWidth={1.75} />
                    </button>
                </div>

                {step === "services" && (
                    <>
                        {error && (
                            <p className="mb-3 text-sm text-alert-500">
                                {error}
                            </p>
                        )}
                        <ConsultationServices
                            consultationId={consultationId}
                            saveLabel="Save & continue"
                            requireItems
                            onSaved={handleSaved}
                        />
                    </>
                )}

                {step === "working" && (
                    <p className="py-8 text-center text-sm text-muted">
                        Creating bill…
                    </p>
                )}

                {step === "done" && bill && (
                    <div className="text-center">
                        <CheckCircle2
                            size={36}
                            strokeWidth={1.5}
                            className="mx-auto text-clinical-600"
                        />
                        <p className="mt-2 break-all text-xs text-muted">
                            {bill.bill_no}
                        </p>
                        <p className="mt-1 text-2xl font-medium text-ink">
                            {money(bill.total)}
                        </p>
                        <p className="mt-3 text-sm text-muted">
                            {mobile
                                ? "Download your bill."
                                : "Print or download your bill."}
                        </p>

                        <div className="mt-4 flex flex-col gap-2">
                            {!mobile && (
                                <button
                                    type="button"
                                    onClick={() => run("print")}
                                    disabled={!!busy}
                                    className="inline-flex items-center justify-center gap-2 rounded bg-clinical-500 py-2.5 text-sm font-medium text-paper hover:bg-clinical-600 disabled:opacity-40"
                                >
                                    <Printer size={16} strokeWidth={1.75} />
                                    {busy === "print" ? "Preparing…" : "Print"}
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={() => run("download")}
                                disabled={!!busy}
                                className={`inline-flex items-center justify-center gap-2 rounded py-2.5 text-sm font-medium disabled:opacity-40 ${
                                    mobile
                                        ? "bg-clinical-500 text-paper hover:bg-clinical-600"
                                        : "border border-line bg-surface text-ink hover:bg-paper"
                                }`}
                            >
                                <Download size={16} strokeWidth={1.75} />
                                {busy === "download"
                                    ? "Preparing…"
                                    : "Download"}
                            </button>
                        </div>

                        {notice && (
                            <p className="mt-3 text-sm text-clinical-600">
                                {notice}
                            </p>
                        )}
                        {error && (
                            <p className="mt-3 text-sm text-alert-500">
                                {error}
                            </p>
                        )}

                        <div className="mt-4 flex items-center justify-center gap-4 text-xs">
                            <button
                                type="button"
                                onClick={() => {
                                    setStep("services");
                                    setNotice("");
                                    setError("");
                                }}
                                disabled={!!busy}
                                className="text-clinical-600 underline underline-offset-2 disabled:opacity-40"
                            >
                                Edit services
                            </button>
                            <button
                                type="button"
                                onClick={onClose}
                                disabled={!!busy}
                                className="text-muted underline underline-offset-2 disabled:opacity-40"
                            >
                                Done
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
