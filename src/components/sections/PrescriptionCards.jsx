import React from "react";
import {
    FileSignature,
    Stethoscope,
    Activity,
    Pill,
    CalendarClock,
} from "lucide-react";
import { MetaRow, Chip, CodeRow, SectionCard, usableList } from "./shared";

function SubSection({ icon: Icon, label, tone, children }) {
    return (
        <div className="rounded-md border border-line overflow-hidden">
            <div className={`flex items-center gap-2 px-4 py-2 ${tone}`}>
                <Icon size={14} strokeWidth={1.75} />
                <span className="text-xs font-medium uppercase tracking-wide">
                    {label}
                </span>
            </div>
            <div className="px-4 py-4 bg-surface">{children}</div>
        </div>
    );
}

export function PrescriptionCard({ prescription }) {
    if (!prescription || typeof prescription !== "object") return null;

    const symptoms = usableList(prescription.symptoms);
    const medications = usableList(prescription.medications);
    const diagnosis = usableList(prescription.diagnosis);
    const followup = usableList(prescription.followup);

    const totalCount =
        symptoms.length +
        medications.length +
        diagnosis.length +
        followup.length;
    if (totalCount === 0) return null;

    return (
        <SectionCard
            icon={FileSignature}
            title="Prescription & Plan"
            count={totalCount}
        >
            <div className="space-y-4">
                {diagnosis.length > 0 && (
                    <SubSection
                        icon={Stethoscope}
                        label="Diagnosis"
                        tone="bg-clinical-50 text-clinical-600"
                    >
                        <ul className="space-y-3">
                            {diagnosis.map((d, i) => (
                                <li key={i}>
                                    <p className="text-sm text-ink">{d.name}</p>
                                    <CodeRow
                                        codes={[
                                            {
                                                system: "SNOMED",
                                                code: d.snomed_ct_code,
                                                term: d.snomed_ct_term,
                                                verified:
                                                    d.snomed_ct_code_verified,
                                                corrected:
                                                    d.snomed_ct_code_corrected,
                                            },
                                            {
                                                system: "ICD-10",
                                                code: d.icd10_code,
                                                verified: d.icd10_code_verified,
                                                corrected:
                                                    d.icd10_code_corrected,
                                            },
                                        ]}
                                    />
                                </li>
                            ))}
                        </ul>
                    </SubSection>
                )}

                {symptoms.length > 0 && (
                    <SubSection
                        icon={Activity}
                        label="Presenting symptoms"
                        tone="bg-paper text-ink/70"
                    >
                        <ul className="divide-y divide-line -my-1">
                            {symptoms.map((s, i) => (
                                <li
                                    key={i}
                                    className="py-2.5 first:pt-0 last:pb-0"
                                >
                                    <p className="text-sm text-ink">{s.name}</p>
                                    <CodeRow
                                        codes={[
                                            {
                                                system: "SNOMED",
                                                code: s.snomed_ct_code,
                                                verified:
                                                    s.snomed_ct_code_verified,
                                                corrected:
                                                    s.snomed_ct_code_corrected,
                                            },
                                        ]}
                                    />
                                    <MetaRow
                                        items={[
                                            {
                                                label: "Duration",
                                                value: s.duration,
                                            },
                                            {
                                                label: "Started",
                                                value: s.start_date,
                                            },
                                            {
                                                label: "Ended",
                                                value: s.end_date,
                                            },
                                        ]}
                                    />
                                    {s.notes && (
                                        <p className="text-xs text-muted mt-1">
                                            {s.notes}
                                        </p>
                                    )}
                                </li>
                            ))}
                        </ul>
                    </SubSection>
                )}

                {medications.length > 0 && (
                    <SubSection
                        icon={Pill}
                        label="Prescribed today"
                        tone="bg-paper text-ink/70"
                    >
                        <ul className="divide-y divide-line -my-1">
                            {medications.map((m, i) => (
                                <li
                                    key={i}
                                    className="py-2.5 first:pt-0 last:pb-0"
                                >
                                    <p className="text-sm text-ink">{m.name}</p>
                                    <CodeRow
                                        codes={[
                                            {
                                                system: "RxNorm",
                                                code: m.rxnorm_code,
                                                verified:
                                                    m.rxnorm_code_verified,
                                                corrected:
                                                    m.rxnorm_code_corrected,
                                            },
                                        ]}
                                    />
                                    {Array.isArray(m.dosage) &&
                                        m.dosage.length > 0 && (
                                            <div className="flex flex-wrap mt-1.5">
                                                {m.dosage.map((d, di) => (
                                                    <Chip key={di}>{d}</Chip>
                                                ))}
                                            </div>
                                        )}
                                    <MetaRow
                                        items={[
                                            {
                                                label: "Duration",
                                                value: m.duration,
                                            },
                                        ]}
                                    />
                                    {m.instructions && (
                                        <p className="text-xs text-muted mt-1">
                                            {m.instructions}
                                        </p>
                                    )}
                                </li>
                            ))}
                        </ul>
                    </SubSection>
                )}

                {followup.length > 0 && (
                    <SubSection
                        icon={CalendarClock}
                        label="Follow-up"
                        tone="bg-amber-50 text-amber-400"
                    >
                        <ul className="divide-y divide-line -my-1">
                            {followup.map((f, i) => (
                                <li
                                    key={i}
                                    className="py-2.5 first:pt-0 last:pb-0"
                                >
                                    <MetaRow
                                        items={[
                                            {
                                                label: "Next visit",
                                                value: f.next_visit_duration,
                                            },
                                            { label: "Date", value: f.date },
                                        ]}
                                    />
                                    {f.advice && (
                                        <p className="text-sm text-ink mt-1">
                                            {f.advice}
                                        </p>
                                    )}
                                </li>
                            ))}
                        </ul>
                    </SubSection>
                )}
            </div>
        </SectionCard>
    );
}
