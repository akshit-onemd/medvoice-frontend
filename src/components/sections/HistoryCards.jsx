import React from "react";
import { Users, Footprints, Home, FileText } from "lucide-react";
import {
    SectionCard,
    EmptyNote,
    MetaRow,
    Chip,
    CodeRow,
    usableList,
} from "./shared";
export function FamilyHistoryCard({ familyHistory }) {
    const list = usableList(familyHistory);

    return (
        <SectionCard icon={Users} title="Family History" count={list.length}>
            {list.length === 0 ? (
                <EmptyNote>No family history was discussed.</EmptyNote>
            ) : (
                <ul className="divide-y divide-line -my-1">
                    {list.map((f, i) => (
                        <li key={i} className="py-3 first:pt-0 last:pb-0">
                            <p className="text-sm text-ink">
                                {f.relationship || "Family member"}
                            </p>
                            {Array.isArray(f.illness) &&
                                f.illness.length > 0 && (
                                    <div className="flex flex-wrap items-center mt-1.5">
                                        {f.illness.map((ill, ii) => {
                                            const snomedCode =
                                                f.snomed_ct_codes?.[ii];
                                            const snomedVerified =
                                                f.snomed_ct_codes_verified?.[
                                                    ii
                                                ];
                                            const icd10Code =
                                                f.icd10_codes?.[ii];
                                            const icd10Verified =
                                                f.icd10_codes_verified?.[ii];

                                            const codeStyle = (
                                                verified,
                                                corrected,
                                            ) => ({
                                                color: corrected
                                                    ? "#B8823C"
                                                    : verified === false
                                                      ? "#A8453C"
                                                      : verified === true
                                                        ? undefined
                                                        : "#5C6B67",
                                            });
                                            const codeTitle = (
                                                verified,
                                                corrected,
                                            ) =>
                                                corrected
                                                    ? "Auto-corrected via UMLS"
                                                    : verified === false
                                                      ? "Not found in UMLS — could not auto-correct"
                                                      : verified === true
                                                        ? "Verified in UMLS"
                                                        : "Not yet verified";
                                            return (
                                                <span
                                                    key={ii}
                                                    className="inline-flex items-center mr-1.5 mb-1.5"
                                                >
                                                    <Chip>{ill}</Chip>
                                                    {(snomedCode ||
                                                        icd10Code) && (
                                                        <span className="text-[10px] font-mono -ml-1 space-x-1">
                                                            (
                                                            {snomedCode && (
                                                                <span
                                                                    style={codeStyle(
                                                                        snomedVerified,
                                                                        f
                                                                            .snomed_ct_codes_corrected?.[
                                                                            ii
                                                                        ],
                                                                    )}
                                                                    title={codeTitle(
                                                                        snomedVerified,
                                                                        f
                                                                            .snomed_ct_codes_corrected?.[
                                                                            ii
                                                                        ],
                                                                    )}
                                                                >
                                                                    {snomedCode}
                                                                </span>
                                                            )}
                                                            {snomedCode &&
                                                                icd10Code && (
                                                                    <span className="text-muted">
                                                                        /
                                                                    </span>
                                                                )}
                                                            {icd10Code && (
                                                                <span
                                                                    style={codeStyle(
                                                                        icd10Verified,
                                                                        f
                                                                            .icd10_codes_corrected?.[
                                                                            ii
                                                                        ],
                                                                    )}
                                                                    title={codeTitle(
                                                                        icd10Verified,
                                                                        f
                                                                            .icd10_codes_corrected?.[
                                                                            ii
                                                                        ],
                                                                    )}
                                                                >
                                                                    {icd10Code}
                                                                </span>
                                                            )}
                                                            )
                                                        </span>
                                                    )}
                                                </span>
                                            );
                                        })}
                                    </div>
                                )}{" "}
                            {f.notes && (
                                <p className="text-xs text-muted mt-1">
                                    {f.notes}
                                </p>
                            )}
                        </li>
                    ))}
                </ul>
            )}
        </SectionCard>
    );
}

export function LifestyleCard({ lifestyle }) {
    const list = usableList(lifestyle);

    return (
        <SectionCard
            icon={Footprints}
            title="Lifestyle Habits"
            count={list.length}
        >
            {list.length === 0 ? (
                <EmptyNote>No lifestyle habits were noted.</EmptyNote>
            ) : (
                <ul className="divide-y divide-line -my-1">
                    {list.map((l, i) => (
                        <li key={i} className="py-3 first:pt-0 last:pb-0">
                            <p className="text-sm text-ink">
                                {l.name || "Unnamed habit"}
                            </p>
                            <CodeRow
                                codes={[
                                    {
                                        system: "SNOMED",
                                        code: l.snomed_ct_code,
                                        verified: l.snomed_ct_code_verified,
                                        corrected: l.snomed_ct_code_corrected,
                                    },
                                ]}
                            />
                            <MetaRow
                                items={[
                                    { label: "Frequency", value: l.frequency },
                                    { label: "Duration", value: l.duration },
                                    { label: "Started", value: l.start_date },
                                    { label: "Ended", value: l.end_date },
                                ]}
                            />
                            {l.notes && (
                                <p className="text-xs text-muted mt-1.5">
                                    {l.notes}
                                </p>
                            )}
                        </li>
                    ))}
                </ul>
            )}
        </SectionCard>
    );
}

export function SocialHistoryCard({ socialHistory }) {
    const list = usableList(socialHistory);

    return (
        <SectionCard icon={Home} title="Social History" count={list.length}>
            {list.length === 0 ? (
                <EmptyNote>No social history was recorded.</EmptyNote>
            ) : (
                <ul className="space-y-2.5">
                    {list.map((s, i) => (
                        <li key={i}>
                            <p className="text-sm text-ink">{s.name}</p>
                            <CodeRow
                                codes={[
                                    {
                                        system: "SNOMED",
                                        code: s.snomed_ct_code,
                                        verified: s.snomed_ct_code_verified,
                                        corrected: s.snomed_ct_code_corrected,
                                    },
                                ]}
                            />
                            {s.notes && (
                                <p className="text-xs text-muted mt-0.5">
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

export function OtherHistoryCard({ otherHistory }) {
    const list = usableList(otherHistory);
    if (list.length === 0) return null;

    return (
        <SectionCard icon={FileText} title="Other Notes" count={list.length}>
            <ul className="space-y-2.5">
                {list.map((o, i) => (
                    <li key={i}>
                        <p className="text-sm text-ink">{o.name}</p>
                        {o.notes && (
                            <p className="text-xs text-muted mt-0.5">
                                {o.notes}
                            </p>
                        )}
                    </li>
                ))}
            </ul>
        </SectionCard>
    );
}
