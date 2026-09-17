import React from "react";
import { HeartPulse, Scissors, ClipboardList } from "lucide-react";
import {
    SectionCard,
    EmptyNote,
    MetaRow,
    Chip,
    CodeRow,
    usableList,
} from "./shared";
export function ConditionsCard({ conditions }) {
    const list = usableList(conditions);

    return (
        <SectionCard icon={HeartPulse} title="Conditions" count={list.length}>
            {list.length === 0 ? (
                <EmptyNote>No conditions were noted.</EmptyNote>
            ) : (
                <ul className="divide-y divide-line -my-1">
                    {list.map((c, i) => (
                        <li key={i} className="py-3 first:pt-0 last:pb-0">
                            <p className="text-sm text-ink">
                                {c.name || "Unnamed condition"}
                            </p>
                            <CodeRow
                                codes={[
                                    {
                                        system: "SNOMED",
                                        code: c.snomed_ct_code,
                                        term: c.snomed_ct_term,
                                        verified: c.snomed_ct_code_verified,
                                        corrected: c.snomed_ct_code_corrected,
                                    },
                                    {
                                        system: "ICD-10",
                                        code: c.icd10_code,
                                        verified: c.icd10_code_verified,
                                        corrected: c.icd10_code_corrected,
                                    },
                                ]}
                            />
                            <MetaRow
                                items={[
                                    { label: "Duration", value: c.duration },
                                    { label: "Started", value: c.start_date },
                                    { label: "Ended", value: c.end_date },
                                ]}
                            />
                            {c.notes && (
                                <p className="text-xs text-muted mt-1.5">
                                    {c.notes}
                                </p>
                            )}
                        </li>
                    ))}
                </ul>
            )}
        </SectionCard>
    );
}

export function ProceduresCard({ procedures }) {
    const list = usableList(procedures);

    return (
        <SectionCard icon={Scissors} title="Procedures" count={list.length}>
            {list.length === 0 ? (
                <EmptyNote>No procedures were mentioned.</EmptyNote>
            ) : (
                <ul className="divide-y divide-line -my-1">
                    {list.map((p, i) => (
                        <li key={i} className="py-3 first:pt-0 last:pb-0">
                            <div className="flex items-baseline justify-between gap-2">
                                <p className="text-sm text-ink">
                                    {p.name || "Unnamed procedure"}
                                </p>
                                {p.date && (
                                    <span className="text-xs text-muted shrink-0">
                                        {p.date}
                                    </span>
                                )}
                            </div>
                            <CodeRow
                                codes={[
                                    {
                                        system: "SNOMED",
                                        code: p.snomed_ct_code,
                                        verified: p.snomed_ct_code_verified,
                                        corrected: p.snomed_ct_code_corrected,
                                    },
                                    {
                                        system: "ICD-10-PCS",
                                        code: p.icd10_pcs_code,
                                        verified: p.icd10_pcs_code_verified,
                                        corrected: p.icd10_pcs_code_corrected,
                                    },
                                ]}
                            />
                            {p.notes && (
                                <p className="text-xs text-muted mt-1">
                                    {p.notes}
                                </p>
                            )}
                        </li>
                    ))}
                </ul>
            )}
        </SectionCard>
    );
}

export function SystemReviewCard({ systemReview }) {
    const list = usableList(systemReview);

    return (
        <SectionCard
            icon={ClipboardList}
            title="Review of Systems"
            count={list.length}
        >
            {list.length === 0 ? (
                <EmptyNote>No system review findings were recorded.</EmptyNote>
            ) : (
                <ul className="space-y-4">
                    {list.map((s, i) => (
                        <li key={i}>
                            <p className="text-sm text-ink mb-1.5">
                                {s.name || "Unnamed system"}
                            </p>
                            {Array.isArray(s.findings) &&
                                s.findings.filter((f) => f.finding).length >
                                    0 && (
                                    <div className="flex flex-wrap items-center">
                                        {s.findings
                                            .filter((f) => f.finding)
                                            .map((f, fi) => (
                                                <span
                                                    key={fi}
                                                    className="inline-flex items-center mr-1.5 mb-1.5"
                                                >
                                                    <Chip>{f.finding}</Chip>
                                                    {f.snomed_ct_code && (
                                                        <span
                                                            className="text-[10px] font-mono -ml-1"
                                                            style={{
                                                                color: f.snomed_ct_code_corrected
                                                                    ? "#B8823C"
                                                                    : f.snomed_ct_code_verified ===
                                                                        false
                                                                      ? "#A8453C"
                                                                      : undefined,
                                                            }}
                                                            title={
                                                                f.snomed_ct_code_corrected
                                                                    ? "Auto-corrected via UMLS"
                                                                    : f.snomed_ct_code_verified ===
                                                                        false
                                                                      ? "Not found in UMLS"
                                                                      : f.snomed_ct_code_verified ===
                                                                          true
                                                                        ? "Verified in UMLS"
                                                                        : "Not yet verified"
                                                            }
                                                        >
                                                            ({f.snomed_ct_code})
                                                        </span>
                                                    )}
                                                </span>
                                            ))}
                                    </div>
                                )}
                            {s.notes && (
                                <p className="text-xs text-muted mt-1">
                                    {s.notes}
                                </p>
                            )}
                        </li>
                    ))}
                </ul>
            )}
        </SectionCard>
    );
}
