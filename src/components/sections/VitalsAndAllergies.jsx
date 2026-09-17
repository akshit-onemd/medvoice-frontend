import React from "react";
import { Activity, ShieldAlert } from "lucide-react";
import { SectionCard, EmptyNote, CodeRow, usableList } from "./shared";
export function VitalsCard({ vitals }) {
    const list = usableList(vitals).filter((v) => v.value);

    return (
        <SectionCard icon={Activity} title="Vitals" count={list.length}>
            {list.length === 0 ? (
                <EmptyNote>
                    No vitals were recorded in this consultation.
                </EmptyNote>
            ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {list.map((v, i) => (
                        <div
                            key={i}
                            className="rounded border border-line bg-paper px-3 py-2.5"
                        >
                            <p className="text-[11px] text-muted leading-snug">
                                {v.name}
                                {v.loinc_code && (
                                    <span className="font-mono ml-1 opacity-60">
                                        · {v.loinc_code}
                                    </span>
                                )}
                            </p>{" "}
                            <p className="text-lg font-serif text-ink leading-tight mt-0.5">
                                {v.value}
                                {v.units && (
                                    <span className="text-xs text-muted font-sans ml-1">
                                        {v.units}
                                    </span>
                                )}
                            </p>
                        </div>
                    ))}
                </div>
            )}
        </SectionCard>
    );
}

export function AllergiesCard({ allergies }) {
    const list = usableList(allergies);

    return (
        <SectionCard
            icon={ShieldAlert}
            title="Allergies"
            count={list.length}
            tone="alert"
        >
            {list.length === 0 ? (
                <EmptyNote>No allergies were mentioned.</EmptyNote>
            ) : (
                <ul className="space-y-2.5">
                    {list.map((a, i) => (
                        <li key={i} className="flex items-start gap-2.5">
                            <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-alert-400 shrink-0" />
                            <div>
                                <p className="text-sm text-ink">
                                    {a.name || "Unnamed allergy"}
                                </p>
                                <CodeRow
                                    codes={[
                                        {
                                            system: "SNOMED",
                                            code: a.snomed_ct_code,
                                            term: a.snomed_ct_term,
                                            verified: a.snomed_ct_code_verified,
                                            corrected:
                                                a.snomed_ct_code_corrected,
                                        },
                                        {
                                            system: "ICD-10",
                                            code: a.icd10_code,
                                            verified: a.icd10_code_verified,
                                            corrected: a.icd10_code_corrected,
                                        },
                                    ]}
                                />
                                {a.notes && (
                                    <p className="text-xs text-muted mt-1">
                                        {a.notes}
                                    </p>
                                )}
                            </div>{" "}
                        </li>
                    ))}
                </ul>
            )}
        </SectionCard>
    );
}
