import React from "react";
import {
    FileSignature,
    Stethoscope,
    Activity,
    Pill,
    CalendarClock,
} from "lucide-react";
import { MetaRow, Chip, CodeRow, SectionCard, usableList } from "./shared";
import { medLines } from "../../utils/brandDisplay";

function SubSection({ icon: Icon, label, tone, order, children }) {
    return (
        <div
            className="rounded-md border border-line overflow-hidden"
            style={{ order }}
        >
            <div className={`flex items-center gap-2 px-4 py-2 ${tone}`}>
                <Icon size={14} strokeWidth={1.75} />
                <span className="text-sm font-semibold">
                    {label}
                </span>
            </div>
            <div className="px-4 py-4 bg-surface">{children}</div>
        </div>
    );
}

// The parts this card shows, in order, with their titles (from the note's template)
const DEFAULT_PARTS = [
    { type: "diagnosis", title: "Diagnosis" },
    { type: "complaints", title: "Presenting symptoms" },
    { type: "prescription", title: "Prescribed today" },
    { type: "followup", title: "Follow-up" },
];

export function PrescriptionCard({ prescription, parts = DEFAULT_PARTS }) {
    if (!prescription || typeof prescription !== "object") return null;
    const pos = Object.fromEntries(parts.map((p, i) => [p.type, i]));
    const titleOf = (type) => parts.find((p) => p.type === type)?.title;
    const only = (type, list) => (type in pos ? usableList(list) : []);

    const symptoms = only("complaints", prescription.symptoms);
    const medications = only("prescription", prescription.medications);
    const diagnosis = only("diagnosis", prescription.diagnosis);
    const followup = only("followup", prescription.followup);

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
            <div className="flex flex-col gap-4">
                {diagnosis.length > 0 && (
                    <SubSection
                        icon={Stethoscope}
                        label={titleOf("diagnosis")}
                        order={pos.diagnosis}
                        tone="bg-clinical-50 text-clinical-600"
                    >
                        <ul className="space-y-3">
                            {diagnosis.map((d, i) => (
                                <li key={i}>
                                    <p className="font-medium text-base text-ink">
                                        {d.name}
                                    </p>
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
                        label={titleOf("complaints")}
                        order={pos.complaints}
                        tone="bg-paper text-ink/70"
                    >
                        <ul className="divide-y divide-line -my-1">
                            {symptoms.map((s, i) => (
                                <li
                                    key={i}
                                    className="py-2.5 first:pt-0 last:pb-0"
                                >
                                    <p className="font-medium text-base text-ink">
                                        {s.name}
                                    </p>
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
                                        <p className="text-sm text-muted mt-1">
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
                        label={titleOf("prescription")}
                        order={pos.prescription}
                        tone="bg-paper text-ink/70"
                    >
                        <ul className="divide-y divide-line -my-1">
                            {medications.map((m, i) => (
                                <li
                                    key={i}
                                    className="py-2.5 first:pt-0 last:pb-0"
                                >
                                    <p className="font-medium text-base text-ink">
                                        {medLines(m).primary}
                                    </p>
                                    {medLines(m).secondary && (
                                        <p className="text-xs text-muted">
                                            {medLines(m).secondary}
                                        </p>
                                    )}
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
                                        <p className="text-sm text-muted mt-1">
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
                        label={titleOf("followup")}
                        order={pos.followup}
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
                                        <p className="font-medium text-base text-ink mt-1">
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
