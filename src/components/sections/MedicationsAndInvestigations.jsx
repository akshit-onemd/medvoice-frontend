import React from "react";
import { Pill, FlaskConical } from "lucide-react";
import {
    SectionCard,
    EmptyNote,
    MetaRow,
    Chip,
    CodeRow,
    usableList,
} from "./shared";
const STATUS_TONE = {
    active: "bg-clinical-50 text-clinical-600",
    ongoing: "bg-clinical-50 text-clinical-600",
    discontinued: "bg-alert-50 text-alert-500",
    stopped: "bg-alert-50 text-alert-500",
    completed: "bg-paper text-muted border border-line",
};

function StatusTag({ status }) {
    if (!status) return null;
    const key = status.toLowerCase();
    const cls = STATUS_TONE[key] || "bg-paper text-muted border border-line";
    return (
        <span className={`rounded px-2 py-0.5 text-[11px] shrink-0 ${cls}`}>
            {status}
        </span>
    );
}

export function MedicationsCard({ medications }) {
    const list = usableList(medications);

    return (
        <SectionCard icon={Pill} title="Medications" count={list.length}>
            {list.length === 0 ? (
                <EmptyNote>No medications were discussed.</EmptyNote>
            ) : (
                <ul className="divide-y divide-line -my-1">
                    {list.map((m, i) => (
                        <li key={i} className="py-3 first:pt-0 last:pb-0">
                            <div className="flex items-start justify-between gap-2">
                                <p className="text-sm text-ink">
                                    {m.name || "Unnamed medication"}
                                    {m.dosage && (
                                        <span className="text-muted">
                                            {" "}
                                            · {m.dosage}
                                        </span>
                                    )}
                                </p>
                                <StatusTag status={m.status} />
                            </div>
                            <CodeRow
                                codes={[
                                    {
                                        system: "RxNorm",
                                        code: m.rxnorm_code,
                                        verified: m.rxnorm_code_verified,
                                        corrected: m.rxnorm_code_corrected,
                                    },
                                ]}
                            />
                            <MetaRow
                                items={[
                                    { label: "Duration", value: m.duration },
                                    { label: "Started", value: m.start_date },
                                    { label: "Ended", value: m.end_date },
                                ]}
                            />
                            {Array.isArray(m.instruction) &&
                                m.instruction.length > 0 && (
                                    <div className="flex flex-wrap mt-1.5">
                                        {m.instruction.map((ins, ii) => (
                                            <Chip key={ii}>{ins}</Chip>
                                        ))}
                                    </div>
                                )}
                        </li>
                    ))}
                </ul>
            )}
        </SectionCard>
    );
}

export function InvestigationsCard({ investigations }) {
    const list = usableList(investigations);

    return (
        <SectionCard
            icon={FlaskConical}
            title="Investigations"
            count={list.length}
        >
            {list.length === 0 ? (
                <EmptyNote>
                    No investigations or lab results were mentioned.
                </EmptyNote>
            ) : (
                <ul className="space-y-5">
                    {list.map((inv, i) => (
                        <li key={i}>
                            <div className="flex items-baseline justify-between gap-2">
                                <p className="text-sm text-ink">
                                    {inv.name || "Unnamed investigation"}
                                </p>
                                {inv.date && (
                                    <span className="text-xs text-muted shrink-0">
                                        {inv.date}
                                    </span>
                                )}
                            </div>
                            {Array.isArray(inv.readings) &&
                                inv.readings.filter(
                                    (r) => r.investigation_name || r.result,
                                ).length > 0 && (
                                    <div className="mt-2 rounded border border-line overflow-hidden">
                                        {inv.readings
                                            .filter(
                                                (r) =>
                                                    r.investigation_name ||
                                                    r.result,
                                            )
                                            .map((r, ri) => (
                                                <div
                                                    key={ri}
                                                    className="flex items-center justify-between gap-3 px-3 py-2 text-xs odd:bg-paper"
                                                >
                                                    <span className="text-ink">
                                                        {r.investigation_name}
                                                        {r.loinc_code && (
                                                            <span
                                                                className="font-mono ml-1"
                                                                style={{
                                                                    color: r.loinc_code_corrected
                                                                        ? "#B8823C"
                                                                        : r.loinc_code_verified ===
                                                                            false
                                                                          ? "#A8453C"
                                                                          : "#5C6B67",
                                                                    opacity:
                                                                        r.loinc_code_verified ===
                                                                            true &&
                                                                        !r.loinc_code_corrected
                                                                            ? 0.6
                                                                            : 1,
                                                                }}
                                                                title={
                                                                    r.loinc_code_corrected
                                                                        ? "Auto-corrected via UMLS"
                                                                        : r.loinc_code_verified ===
                                                                            false
                                                                          ? "Not found in UMLS"
                                                                          : r.loinc_code_verified ===
                                                                              true
                                                                            ? "Verified in UMLS"
                                                                            : "Not yet verified"
                                                                }
                                                            >
                                                                · {r.loinc_code}
                                                            </span>
                                                        )}
                                                    </span>{" "}
                                                    <span className="text-muted text-right">
                                                        {r.result} {r.unit}
                                                        {r.interpretation && (
                                                            <span
                                                                className="ml-2 text-amber-400"
                                                                title={
                                                                    r.interpretation_snomed_code ||
                                                                    undefined
                                                                }
                                                            >
                                                                {
                                                                    r.interpretation
                                                                }
                                                            </span>
                                                        )}
                                                    </span>{" "}
                                                </div>
                                            ))}
                                    </div>
                                )}
                        </li>
                    ))}
                </ul>
            )}
        </SectionCard>
    );
}
