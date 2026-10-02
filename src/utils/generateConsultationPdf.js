import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

const MARGIN = 14;
const FOOTER = 18;
const INK = [25, 25, 25];
const SUB = [90, 90, 90];
const MUTED = [120, 120, 120];
const BRAND = [38, 84, 72];
const BAND = [240, 241, 241];
const LINE = [205, 205, 205];

// Trim + fix missing spaces after punctuation
// "TMT,lipid" -> "TMT, lipid" | "exertion.Go" -> "exertion. Go"
// Numbers (1,000 / 10:30 / 5.5) are left alone.
const txt = (v) =>
    v === null || v === undefined
        ? ""
        : String(v)
              .trim()
              .replace(/([,;:])(?=[A-Za-z])/g, "$1 ")
              .replace(/([.!?])(?=[A-Z][a-z])/g, "$1 ");

// Placeholder for empty values
const or = (v) => txt(v) || "-";

const list = (a) => (Array.isArray(a) ? a : []);
const join = (arr, sep = ", ") =>
    Array.isArray(arr) ? arr.map(txt).filter(Boolean).join(sep) : txt(arr);
const dash = (parts) => parts.map(txt).filter(Boolean).join(" · ");
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : "");
// Adds "Dr." unless the name already starts with it (Dr, Dr., DR, dr. ...)
const withDr = (name) => {
    const n = txt(name);
    if (!n) return "";
    return /^dr\b\.?\s*/i.test(n)
        ? n.replace(/^dr\b\.?\s*/i, "Dr. ")
        : `Dr. ${n}`;
};
const has = (e, keys) =>
    keys.some((k) =>
        Array.isArray(e?.[k]) ? e[k].some((x) => txt(x)) : txt(e?.[k]) !== "",
    );
const period = (e) =>
    dash([
        e.duration,
        [txt(e.start_date), txt(e.end_date)].filter(Boolean).join(" to "),
    ]);

const B = (t) => ({ text: t, bold: true });
const N = (t) => ({ text: t, color: SUB });
const SEP = N("  -  ");
const NOTE = (t) => N(`  (${txt(t)})`);
const item = (primary, secondary) =>
    secondary ? [B(primary), SEP, N(secondary)] : [B(primary)];

export function generateConsultationPdf(
    result,
    { includeTranscript = false, doctor = null } = {},
) {
    const data = result?.structured_data || {};
    const saved = result?.saved || {};
    const rx = data.prescription || {};

    const mk = () => new jsPDF({ unit: "mm", format: "a4" });
    let doc = mk(); // reassigned temporarily while measuring sections
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();

    const contentW = pageW - MARGIN * 2;
    // ---- Letterhead: only the header and footer strips are used ----
    const lhHeader = doctor?.letterhead_header || null;
    const lhFooter = doctor?.letterhead_footer || null;
    const hasHeaderArt = !!lhHeader;
    const hasFooterArt = !!lhFooter;
    const lhTop = Math.min(
        60,
        Math.max(0, Number(doctor?.letterhead_top_pct) || 0),
    );
    const lhBottom = Math.min(
        100,
        Math.max(40, Number(doctor?.letterhead_bottom_pct) || 100),
    );
    const headerH = (pageH * lhTop) / 100;
    const footerStart = (pageH * lhBottom) / 100;
    const TOP = hasHeaderArt ? Math.max(MARGIN, headerH + 3) : MARGIN;
    const contentBottom = hasFooterArt
        ? Math.min(footerStart, pageH - 8)
        : null;
    const limit = hasFooterArt ? contentBottom - 6 : pageH - FOOTER;
    let y = TOP;

    let measuring = false;
    const drawBg = () => {
        if (measuring) return;
        try {
            if (lhHeader) {
                doc.addImage(
                    lhHeader,
                    "JPEG",
                    0,
                    0,
                    pageW,
                    headerH,
                    "lh-header",
                    "FAST",
                );
            }
            if (lhFooter) {
                doc.addImage(
                    lhFooter,
                    "JPEG",
                    0,
                    footerStart,
                    pageW,
                    pageH - footerStart,
                    "lh-footer",
                    "FAST",
                );
            }
        } catch {
            /* unreadable strip: carry on without it */
        }
    };
    const newPage = () => {
        doc.addPage();
        drawBg();
        y = TOP;
    };

    const ensureSpace = (n) => {
        if (y + n > limit) newPage();
    };

    // Draw a section on a scratch document to learn how tall it is
    const measure = (fn) => {
        const realDoc = doc;
        const realY = y;
        doc = mk();
        y = TOP;
        measuring = true;
        fn();
        measuring = false;
        const h = (doc.getNumberOfPages() - 1) * (limit - TOP) + (y - TOP);
        doc = realDoc;
        y = realY;
        return h;
    };
    // Grey label band, like the reference document
    const band = (title) => {
        ensureSpace(18);
        doc.setFillColor(...BAND);
        doc.rect(MARGIN, y, contentW, 7, "F");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(...MUTED);
        doc.text(title.toUpperCase(), MARGIN + 3, y + 4.8);
        y += 12;
    };

    // Major group title (Medical history / Prescription)
    const groupHeading = (title) => {
        ensureSpace(24);
        y += 2; // was 3
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.setTextColor(...BRAND);
        doc.text(title, MARGIN, y);
        doc.setDrawColor(...BRAND);
        doc.setLineWidth(0.5);
        doc.line(MARGIN, y + 2, pageW - MARGIN, y + 2);
        y += 6; // was 9
    };
    // Mixed bold/normal text that wraps across segments
    const flow = (segs, { indent = 0, size = 10 } = {}) => {
        const lh = size * 0.3528 * 1.4;
        const startX = MARGIN + indent;
        const maxX = pageW - MARGIN;
        let x = startX;
        ensureSpace(lh + 1);
        for (const seg of segs) {
            // Keep raw spacing (separators rely on it); only fix punctuation
            const raw = seg.text == null ? "" : String(seg.text);
            if (!raw.trim()) continue;
            const s = raw
                .replace(/([,;:])(?=[A-Za-z])/g, "$1 ")
                .replace(/([.!?])(?=[A-Z][a-z])/g, "$1 ");
            doc.setFont("helvetica", seg.bold ? "bold" : "normal");
            doc.setFontSize(size);
            doc.setTextColor(...(seg.color || INK));
            for (const tok of s.match(/\S+|\s+/g) || []) {
                const w = doc.getTextWidth(tok);
                if (/^\s+$/.test(tok)) {
                    if (x > startX) x += w;
                    continue;
                }
                if (x + w > maxX && x > startX) {
                    y += lh;
                    ensureSpace(lh + 1);
                    x = startX;
                }
                doc.text(tok, x, y);
                x += w;
            }
        }
        y += lh;
    };

    const bullet = (segs) => {
        ensureSpace(12);
        doc.setFillColor(...MUTED);
        doc.circle(MARGIN + 1.6, y - 1.1, 0.55, "F");
        flow(segs, { indent: 5 });
        y += 1.8;
    };
    let tableStartPage = 1;
    const runTable = (opts) => {
        tableStartPage = doc.getNumberOfPages();
        autoTable(doc, opts);
    };
    const tableStyles = {
        theme: "grid",
        margin: {
            left: MARGIN,
            right: MARGIN,
            top: TOP,
            bottom: pageH - limit,
        },
        willDrawPage: (d) => {
            if (d.pageNumber > tableStartPage) drawBg(); // long tables that spill onto a new page
        },
        styles: {
            fontSize: 9.5,
            cellPadding: 2.4,
            textColor: INK,
            lineColor: LINE,
            lineWidth: 0.2,
            overflow: "linebreak",
            valign: "middle",
        },
        headStyles: {
            fillColor: BAND,
            textColor: MUTED,
            fontStyle: "bold",
            fontSize: 8.5,
        },
    };

    let group = null;
    const enterGroup = (name) => {
        if (group !== name) {
            groupHeading(name);
            group = name;
        }
    };
    const section = (groupName, title, ok, render) => {
        if (!ok) return;

        const draw = () => {
            if (groupName) enterGroup(groupName);
            band(title);
            render();
        };

        // Measure on the scratch page without disturbing the group state
        const prevGroup = group;
        const h = measure(draw);
        group = prevGroup;

        if (h <= limit - TOP && y + h > limit) newPage();
        draw();
        y += 1.5;
    };
    drawBg();
    // ---------- Header (doctor details + brand) ----------
    if (!hasHeaderArt) {
        const headLines = doctor
            ? [
                  txt(doctor.qualification),
                  txt(doctor.registration_no)
                      ? `Reg. No: ${txt(doctor.registration_no)}`
                      : "",
                  txt(doctor.email) ? `Email: ${txt(doctor.email)}` : "",
                  [txt(doctor.clinic_name), txt(doctor.clinic_address)]
                      .filter(Boolean)
                      .join(", "),
              ].filter(Boolean)
            : [];

        doc.setFont("helvetica", "bold");
        doc.setFontSize(15);
        doc.setTextColor(...INK);
        doc.text(withDr(doctor?.name) || "Consultation Report", MARGIN, y + 5);
        let hy = y + 5;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(...SUB);
        headLines.forEach((line) => {
            doc.splitTextToSize(line, 115).forEach((part) => {
                hy += 4.6;
                doc.text(part, MARGIN, hy);
            });
        });

        doc.setFont("helvetica", "bold");
        doc.setFontSize(13);
        doc.setTextColor(...BRAND);
        doc.text("OneMD", pageW - MARGIN, y + 5, { align: "right" });
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(...MUTED);
        doc.text("Appointment Summary", pageW - MARGIN, y + 10, {
            align: "right",
        });

        doc.setDrawColor(...LINE);
        doc.setLineWidth(0.3);
        doc.line(MARGIN, hy + 4, pageW - MARGIN, hy + 4);
        y = hy + 10;
    }

    // ---------- Patient bar ----------
    const when = result?.created_at ? new Date(result.created_at) : new Date();
    const whenStr = when.toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
    });
    const labelValue = (x, yy, label, value, maxW) => {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        doc.setTextColor(...MUTED);
        doc.text(label, x, yy);
        const lw = doc.getTextWidth(label) + 2; // fixed 2mm gap after the colon
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.setTextColor(...INK);
        const v = maxW ? doc.splitTextToSize(value, maxW - lw)[0] : value;
        doc.text(v, x + lw, yy);
    };
    doc.setFillColor(...BAND);
    doc.rect(MARGIN, y, contentW, 17, "F");
    labelValue(MARGIN + 3, y + 6.5, "PATIENT:", or(saved.patient_name), 92);
    labelValue(
        MARGIN + 100,
        y + 6.5,
        "AGE:",
        saved.patient_age ? `${saved.patient_age} yrs` : "-",
    );
    labelValue(
        MARGIN + 140,
        y + 6.5,
        "GENDER:",
        cap(txt(saved.patient_gender)) || "-",
    );
    labelValue(MARGIN + 3, y + 13, "DATE & TIME:", whenStr);
    labelValue(MARGIN + 100, y + 13, "PHONE:", or(saved.patient_phone));
    y += 24;

    // ---------- Symptoms / Complaints (top) ----------
    const symptoms = list(rx.symptoms).filter((e) => has(e, ["name"]));
    section(null, "Symptoms / Complaints", symptoms.length > 0, () => {
        symptoms.forEach((e) =>
            bullet(item(txt(e.name), dash([period(e), e.notes]))),
        );
    });

    // ---------- Medical history ----------
    const HIST = "Medical history";

    const allergies = list(data.allergies).filter((e) => has(e, ["name"]));
    section(HIST, "Allergies", allergies.length > 0, () => {
        allergies.forEach((e) => bullet(item(txt(e.name), txt(e.notes))));
    });

    // Vitals as a compact grid (BP combined into one cell)
    const vitals = list(data.vitals).filter((v) => txt(v?.value) !== "");
    const cells = [];
    const find = (n) => vitals.find((v) => txt(v.name).toLowerCase() === n);
    const sys = find("systolic blood pressure");
    const dia = find("diastolic blood pressure");
    if (sys || dia) {
        cells.push({
            label: "Blood pressure",
            value: `${txt(sys?.value) || "-"}/${txt(dia?.value) || "-"}`,
            unit: "mmHg",
        });
    }
    const shortName = {
        "body temperature": "Temperature",
        "body weight": "Weight",
        "body height": "Height",
        respiration: "Respiration",
    };
    vitals
        .filter((v) => v !== sys && v !== dia)
        .forEach((v) =>
            cells.push({
                label: shortName[txt(v.name).toLowerCase()] || txt(v.name),
                value: txt(v.value),
                unit: txt(v.units),
            }),
        );
    section(HIST, "Vitals", cells.length > 0, () => {
        const cols = 4;
        const cw = contentW / cols;
        cells.forEach((c, i) => {
            const col = i % cols;
            if (col === 0) {
                if (i > 0) y += 13;
                ensureSpace(13);
            }
            const x = MARGIN + 3 + col * cw;
            doc.setFont("helvetica", "bold");
            doc.setFontSize(12);
            doc.setTextColor(...INK);
            doc.text(c.value, x, y + 3);
            const vw = doc.getTextWidth(c.value);
            doc.setFont("helvetica", "normal");
            doc.setFontSize(8);
            doc.setTextColor(...MUTED);
            if (c.unit) doc.text(c.unit, x + vw + 1, y + 3);
            doc.text(c.label, x, y + 7.5);
        });
        y += 13;
    });

    const conditions = list(data.conditions).filter((e) => has(e, ["name"]));
    section(HIST, "Conditions", conditions.length > 0, () => {
        conditions.forEach((e) =>
            bullet(item(txt(e.name), dash([period(e), e.notes]))),
        );
    });

    const review = list(data.system_review).filter((e) => has(e, ["name"]));
    section(HIST, "System review", review.length > 0, () => {
        review.forEach((e) => {
            const findings = list(e.findings)
                .map((f) => txt(f.finding))
                .filter(Boolean)
                .join(", ");
            const segs = [B(txt(e.name))];
            if (findings) segs.push(SEP, B(findings));
            if (txt(e.notes)) segs.push(NOTE(e.notes));
            bullet(segs);
        });
    });

    const family = list(data.family_history).filter((e) =>
        has(e, ["relationship", "illness"]),
    );
    section(HIST, "Family history", family.length > 0, () => {
        family.forEach((e) => {
            const segs = [];
            if (txt(e.relationship)) segs.push(B(txt(e.relationship)));
            if (join(e.illness)) {
                if (segs.length) segs.push(SEP);
                segs.push(B(join(e.illness)));
            }
            if (txt(e.notes)) segs.push(NOTE(e.notes));
            bullet(segs);
        });
    });

    const meds = list(data.medication_history).filter((e) => has(e, ["name"]));
    section(HIST, "Medication history", meds.length > 0, () => {
        meds.forEach((e) =>
            bullet(
                item(
                    txt(e.name),
                    dash([
                        e.dosage,
                        period(e),
                        e.status,
                        join(e.instruction, "; "),
                    ]),
                ),
            ),
        );
    });

    const invs = list(data.investigation_history).filter(
        (i) =>
            has(i, ["name", "date"]) ||
            list(i.readings).some((r) =>
                has(r, ["investigation_name", "result"]),
            ),
    );
    section(HIST, "Investigations", invs.length > 0, () => {
        invs.forEach((inv) => {
            const heading = [B(txt(inv.name) || "Results")];
            if (txt(inv.date)) heading.push(N(`  (${txt(inv.date)})`));
            flow(heading);
            const rows = list(inv.readings)
                .filter((r) => has(r, ["investigation_name", "result"]))
                .map((r) => [
                    or(r.investigation_name),
                    or([txt(r.result), txt(r.unit)].filter(Boolean).join(" ")),
                    or(dash([r.interpretation, r.notes])),
                ]);
            if (rows.length) {
                runTable({
                    ...tableStyles,
                    startY: y - 1,
                    head: [["Test", "Result", "Interpretation / notes"]],
                    body: rows,
                    columnStyles: {
                        0: { fontStyle: "bold" },
                        1: { fontStyle: "bold" },
                    },
                });
                y = doc.lastAutoTable.finalY + 4;
            }
        });
    });

    const procedures = list(data.procedures).filter((e) => has(e, ["name"]));
    section(HIST, "Procedures", procedures.length > 0, () => {
        procedures.forEach((e) =>
            bullet(item(txt(e.name), dash([e.date, e.notes]))),
        );
    });

    const lifestyle = list(data.lifestyle_habits).filter((e) =>
        has(e, ["name"]),
    );
    section(HIST, "Lifestyle habits", lifestyle.length > 0, () => {
        lifestyle.forEach((e) =>
            bullet(item(txt(e.name), dash([e.frequency, period(e), e.notes]))),
        );
    });

    const social = list(data.social_history).filter((e) => has(e, ["name"]));
    section(HIST, "Social history", social.length > 0, () => {
        social.forEach((e) => bullet(item(txt(e.name), txt(e.notes))));
    });

    const other = list(data.other_history).filter((e) => has(e, ["name"]));
    section(HIST, "Other history", other.length > 0, () => {
        other.forEach((e) => bullet(item(txt(e.name), txt(e.notes))));
    });

    // ---------- Prescription: Medications → Diagnosis → Follow up ----------
    const RX = "Prescription";

    const rxMeds = list(rx.medications).filter((e) => has(e, ["name"]));
    section(RX, "Medications", rxMeds.length > 0, () => {
        runTable({
            ...tableStyles,
            startY: y - 2,
            head: [["Medicine", "Dosage", "Duration", "Instructions"]],
            body: rxMeds.map((e) => [
                or(e.name),
                or(join(e.dosage, "; ")),
                or(e.duration),
                or(e.instructions),
            ]),
            columnStyles: {
                0: { fontStyle: "bold" },
                1: { cellWidth: 30, halign: "center", fontStyle: "bold" },
                2: { cellWidth: 26, halign: "center" },
            },
        });
        y = doc.lastAutoTable.finalY + 4;
    });

    const dx = list(rx.diagnosis).filter((e) => has(e, ["name"]));
    section(RX, "Diagnosis", dx.length > 0, () => {
        dx.forEach((e) => bullet([B(txt(e.name))]));
    });

    const follow = list(rx.followup).filter((e) =>
        has(e, ["next_visit_duration", "date", "advice"]),
    );
    section(RX, "Follow up", follow.length > 0, () => {
        follow.forEach((e, i) => {
            if (i > 0) y += 1.5;
            [
                ["Next visit", e.next_visit_duration],
                ["Date", e.date],
                ["Advice", e.advice],
            ]
                .filter(([, v]) => txt(v))
                .forEach(([l, v]) => {
                    flow([
                        { text: `${l.toUpperCase()}:  `, color: MUTED },
                        B(txt(v)),
                    ]);
                    y += 1;
                });
        });
    });

    // ---------- Consultation summary (end) ----------
    // const cs = data.consultation_summary;
    // const overview = Array.isArray(cs) ? "" : txt(cs?.overview);
    // const details = (Array.isArray(cs) ? cs : cs?.details || [])
    //     .map(txt)
    //     .filter(Boolean);
    // if (overview || details.length) {
    //     enterGroup("Consultation summary");
    //     if (overview) {
    //         flow([{ text: overview }]);
    //         y += 1;
    //     }
    //     details.forEach((d) => bullet([{ text: d, color: SUB }]));
    // }
    // ---------- Doctor signature ----------
    if (doctor?.signature_data) {
        ensureSpace(48);
        y += 6;
        const bw = 62;
        const bx = pageW - MARGIN - bw;
        try {
            const p = doc.getImageProperties(doctor.signature_data);
            const maxW = 50;
            const maxH = 20;
            let w = maxW;
            let h = (p.height / p.width) * w;
            if (h > maxH) {
                h = maxH;
                w = (p.width / p.height) * h;
            }
            doc.addImage(
                doctor.signature_data,
                doctor.signature_data.includes("image/png") ? "PNG" : "JPEG",
                bx,
                y,
                w,
                h,
            );
            y += h + 2;
        } catch {
            y += 12; // bad image: leave a blank signing space instead of failing the PDF
        }
        doc.setDrawColor(...INK);
        doc.setLineWidth(0.3);
        doc.line(bx, y, bx + bw, y);
        y += 5;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.setTextColor(...INK);
        doc.text(withDr(doctor.name), bx, y);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(...SUB);
        [
            txt(doctor.qualification),
            txt(doctor.registration_no)
                ? `Reg. No: ${txt(doctor.registration_no)}`
                : "",
        ]
            .filter(Boolean)
            .forEach((line) => {
                y += 4.5;
                doc.text(line, bx, y);
            });
        y += 6;
    }
    // ---------- Optional transcript ----------
    if (includeTranscript) {
        const t = txt(result?.diarizedTranscript || result?.transcript);
        if (t) {
            enterGroup("Transcript");
            if (/[^\u0000-\u024F\u2000-\u206F]/.test(t)) {
                flow(
                    [
                        N(
                            "Transcript contains non-Latin script and is omitted from this PDF.",
                        ),
                    ],
                    {
                        size: 9,
                    },
                );
            } else {
                t.split("\n").forEach((line) =>
                    flow([{ text: line }], { size: 9 }),
                );
            }
        }
    }

    // ---------- Footer on every page ----------
    const pages = doc.getNumberOfPages();
    const footerY = hasFooterArt ? contentBottom - 1.5 : pageH - 8;
    for (let i = 1; i <= pages; i++) {
        doc.setPage(i);
        if (!hasFooterArt) {
            doc.setDrawColor(...LINE);
            doc.setLineWidth(0.3);
            doc.line(MARGIN, pageH - 13, pageW - MARGIN, pageH - 13);
        }
        doc.setFont("helvetica", "normal");
        doc.setFontSize(hasFooterArt ? 7 : 8);
        doc.setTextColor(...MUTED);
        doc.text(
            `${txt(saved.patient_name) || "Patient"} · AI-generated from consultation audio. Verify before clinical use.`,
            MARGIN,
            footerY,
        );
        doc.text(`Page ${i} of ${pages}`, pageW - MARGIN, footerY, {
            align: "right",
        });
    }
    const safe = (s) =>
        txt(s)
            .replace(/[^a-z0-9]+/gi, "-")
            .replace(/^-|-$/g, "");
    doc.save(
        `${safe(saved.patient_name) || "patient"} ${when.getFullYear()}-${String(when.getMonth() + 1).padStart(2, "0")}-${String(when.getDate()).padStart(2, "0")} ${when.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", second: "2-digit", hour12: true }).replace(/:/g, ".").replace(/\s/g, " ")}.pdf`,
    );
}
