import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

const MARGIN = 14;
const INK = [25, 25, 25];
const SUB = [90, 90, 90];
const MUTED = [120, 120, 120];
const BRAND = [38, 84, 72];
const BAND = [240, 241, 241];
const LINE = [205, 205, 205];

const txt = (v) => (v === null || v === undefined ? "" : String(v).trim());
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : "");
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const withDr = (name) => {
    const n = txt(name);
    if (!n) return "";
    return /^dr\b\.?\s*/i.test(n)
        ? n.replace(/^dr\b\.?\s*/i, "Dr. ")
        : `Dr. ${n}`;
};
const regLine = (d) => {
    const no = txt(d?.registration_no);
    const council = txt(d?.council_name);
    if (no) return `Reg. No: ${no}${council ? ` (${council})` : ""}`;
    return council ? `Council: ${council}` : "";
};
// Helvetica has no rupee glyph. Use "Rs."
const amt = (n) =>
    Number(n).toLocaleString("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
const rs = (n) => `Rs. ${amt(n)}`;
const fmtMobile = (m) => {
    const d = txt(m);
    return /^\d{10}$/.test(d) ? `+91 ${d.slice(0, 5)} ${d.slice(5)}` : d;
};
const mobileLine = (d) =>
    txt(d?.mobile) ? `Mobile: ${fmtMobile(d.mobile)}` : "";
export function generateBillPdf(bill, { doctor = null, mode = "save" } = {}) {
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const contentW = pageW - MARGIN * 2;

    // Letterhead strips (header above top line, footer below bottom line)
    const lhHeader = doctor?.letterhead_header || null;
    const lhFooter = doctor?.letterhead_footer || null;
    const lhTop = clamp(Number(doctor?.letterhead_top_pct) || 0, 0, 60);
    const lhBottom = clamp(
        Number(doctor?.letterhead_bottom_pct) || 100,
        40,
        100,
    );
    const headerH = (pageH * lhTop) / 100;
    const footerStart = (pageH * lhBottom) / 100;
    const TOP = lhHeader ? Math.max(MARGIN, headerH + 3) : MARGIN;
    const contentBottom = lhFooter ? Math.min(footerStart, pageH - 8) : null;
    const limit = lhFooter ? contentBottom - 6 : pageH - 18;
    let y = TOP;

    const drawBg = () => {
        try {
            if (lhHeader)
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
            if (lhFooter)
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
        } catch {
            /* unreadable strip: carry on */
        }
    };
    const ensureSpace = (n) => {
        if (y + n > limit) {
            doc.addPage();
            drawBg();
            y = TOP;
        }
    };

    drawBg();

    // ---------- Header ----------
    if (!lhHeader) {
        const lines = doctor
            ? [
                  txt(doctor.qualification),
                  regLine(doctor),
                  mobileLine(doctor),
                  txt(doctor.email) ? `Email: ${txt(doctor.email)}` : "",
                  [txt(doctor.clinic_name), txt(doctor.clinic_address)]
                      .filter(Boolean)
                      .join(", "),
              ].filter(Boolean)
            : [];
        doc.setFont("helvetica", "bold");
        doc.setFontSize(15);
        doc.setTextColor(...INK);
        doc.text(withDr(doctor?.name) || "Bill", MARGIN, y + 5);
        let hy = y + 5;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(...SUB);
        lines.forEach((line) => {
            doc.splitTextToSize(line, 120).forEach((part) => {
                hy += 4.6;
                doc.text(part, MARGIN, hy);
            });
        });
        doc.setDrawColor(...LINE);
        doc.setLineWidth(0.3);
        doc.line(MARGIN, hy + 4, pageW - MARGIN, hy + 4);
        y = hy + 10;
    }

    // ---------- Title ----------
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(...BRAND);
    doc.text("BILL", MARGIN, y + 4);
    y += 9;

    // ---------- Bill and patient details ----------
    const labelValue = (x, yy, label, value, maxW) => {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        doc.setTextColor(...MUTED);
        doc.text(label, x, yy);
        const lw = doc.getTextWidth(label) + 2;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.setTextColor(...INK);
        const v = maxW ? doc.splitTextToSize(value, maxW - lw)[0] : value;
        doc.text(v, x + lw, yy);
    };
    const p = bill.patient || {};
    const dateStr = new Date(bill.created_at).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    });
    const ageGender =
        [p.age != null ? `${p.age} yrs` : "", cap(txt(p.gender))]
            .filter(Boolean)
            .join(" / ") || "-";

    doc.setFillColor(...BAND);
    doc.rect(MARGIN, y, contentW, 23, "F");
    labelValue(MARGIN + 3, y + 6.5, "BILL NO:", txt(bill.bill_no), 110);
    labelValue(MARGIN + 120, y + 6.5, "DATE:", dateStr);
    labelValue(MARGIN + 3, y + 13, "PATIENT:", txt(p.name) || "-", 110);
    labelValue(MARGIN + 120, y + 13, "AGE / GENDER:", ageGender);
    labelValue(MARGIN + 3, y + 19.5, "PHONE:", txt(p.phone) || "-");
    y += 29;

    // ---------- Items ----------
    const tableBase = {
        theme: "grid",
        rowPageBreak: "avoid",
        margin: {
            left: MARGIN,
            right: MARGIN,
            top: TOP,
            bottom: pageH - limit,
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
    const runTable = (opts) => {
        const startPage = doc.getNumberOfPages();
        autoTable(doc, {
            ...tableBase,
            ...opts,
            willDrawPage: (d) => {
                if (d.pageNumber > startPage) drawBg();
            },
        });
        y = doc.lastAutoTable.finalY;
    };

    // One row per printed line. Bundles print as a named row with members
    // listed under it, or as plain service rows with no bundle name.
    const rowsData = [];
    let rowNo = 0;
    for (const it of bill.items) {
        if (it.type === "bundle") {
            const lines = Array.isArray(it.lines) ? it.lines : [];
            if (it.mode === "services") {
                for (const l of lines) {
                    rowsData.push({
                        no: ++rowNo,
                        name: l.name,
                        desc: l.description,
                        members: [],
                        qty: l.qty,
                        rate: l.fee,
                        amount: l.base,
                    });
                }
            } else {
                rowsData.push({
                    no: ++rowNo,
                    name: it.name,
                    desc: it.description,
                    members: lines.map(
                        (l) =>
                            `${l.name}${l.member_qty > 1 ? ` x ${l.member_qty}` : ""}`,
                    ),
                    qty: it.qty,
                    rate: it.unit_base,
                    amount: it.base,
                });
            }
        } else {
            rowsData.push({
                no: ++rowNo,
                name: it.name,
                desc: it.description,
                members: [],
                qty: it.qty,
                rate: it.fee,
                amount: it.base,
            });
        }
    }

    const PAD = 2.4;
    const extraLines = (r, width) => {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        const out = [];
        if (txt(r.desc)) out.push(...doc.splitTextToSize(txt(r.desc), width));
        for (const m of r.members)
            out.push(...doc.splitTextToSize(`- ${m}`, width));
        return out;
    };

    runTable({
        startY: y,
        head: [["#", "Service", "Qty", "Rate (Rs.)", "Amount (Rs.)"]],
        body: rowsData.map((r) => [
            String(r.no),
            r.name,
            String(r.qty),
            amt(r.rate),
            amt(r.amount),
        ]),
        columnStyles: {
            0: { cellWidth: 10, halign: "center" },
            1: { fontStyle: "bold" },
            2: { cellWidth: 16, halign: "center" },
            3: { cellWidth: 30, halign: "right" },
            4: { cellWidth: 34, halign: "right", fontStyle: "bold" },
        },
        didParseCell: (d) => {
            if (d.section !== "body" || d.column.index !== 1) return;
            const r = rowsData[d.row.index];
            const innerW = contentW - 90 - PAD * 2; // other columns total 90 mm
            const extra = extraLines(r, innerW);
            if (extra.length === 0) return;
            doc.setFont("helvetica", "bold");
            doc.setFontSize(9.5);
            const nameLines = doc.splitTextToSize(txt(r.name), innerW).length;
            d.cell.styles.valign = "top";
            d.cell.styles.minCellHeight =
                PAD * 2 + nameLines * 3.85 + 0.8 + extra.length * 3.25;
        },
        didDrawCell: (d) => {
            if (d.section !== "body" || d.column.index !== 1) return;
            const r = rowsData[d.row.index];
            const extra = extraLines(r, d.cell.width - PAD * 2);
            if (extra.length === 0) return;
            doc.setFont("helvetica", "normal");
            doc.setFontSize(8);
            doc.setTextColor(...SUB);
            const top = d.cell.y + PAD + d.cell.text.length * 3.85 + 0.8;
            extra.forEach((ln, i) =>
                doc.text(ln, d.cell.x + PAD, top + (i + 0.78) * 3.25),
            );
        },
    });
    y += 6;

    // ---------- Tax summary ----------
    if (bill.tax_summary?.length) {
        ensureSpace(24);
        runTable({
            startY: y,
            head: [["Tax", "Rate", "Taxable (Rs.)", "Tax (Rs.)"]],
            body: bill.tax_summary.map((g) => [
                g.name,
                `${g.rate}%`,
                amt(g.taxable),
                amt(g.tax),
            ]),
            columnStyles: {
                0: { fontStyle: "bold" },
                1: { cellWidth: 22, halign: "center" },
                2: { cellWidth: 38, halign: "right" },
                3: { cellWidth: 34, halign: "right" },
            },
        });
        y += 6;
    }

    // ---------- Totals ----------
    ensureSpace(34);
    const bx = pageW - MARGIN - 80;
    const row = (label, value, bold = false) => {
        doc.setFont("helvetica", bold ? "bold" : "normal");
        doc.setFontSize(bold ? 11.5 : 9.5);
        doc.setTextColor(...(bold ? INK : SUB));
        doc.text(label, bx, y);
        doc.text(value, pageW - MARGIN, y, { align: "right" });
        y += bold ? 7 : 5.5;
    };
    const ro = Number(bill.round_off);
    row("Subtotal", rs(bill.subtotal));
    row("Tax", rs(bill.tax_total));
    row(
        "Round off",
        ro === 0 ? rs(0) : `${ro < 0 ? "-" : "+"}${rs(Math.abs(ro))}`,
    );
    doc.setDrawColor(...INK);
    doc.setLineWidth(0.3);
    doc.line(bx, y - 2.5, pageW - MARGIN, y - 2.5);
    y += 1.5;
    row("Total", rs(bill.total), true);

    // ---------- Signature ----------
    if (doctor?.signature_data) {
        ensureSpace(56);
        y += 8;
        const bw = 62;
        const sx = pageW - MARGIN - bw;
        try {
            const props = doc.getImageProperties(doctor.signature_data);
            let w = 50;
            let h = (props.height / props.width) * w;
            if (h > 20) {
                h = 20;
                w = (props.width / props.height) * h;
            }
            doc.addImage(
                doctor.signature_data,
                doctor.signature_data.includes("image/png") ? "PNG" : "JPEG",
                sx,
                y,
                w,
                h,
            );
            y += h + 2;
        } catch {
            y += 12;
        }
        doc.setDrawColor(...INK);
        doc.setLineWidth(0.3);
        doc.line(sx, y, sx + bw, y);
        y += 5;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.setTextColor(...INK);
        doc.text(withDr(doctor.name), sx, y);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(...SUB);
        [txt(doctor.qualification), regLine(doctor)]
            .filter(Boolean)
            .forEach((line) => {
                doc.splitTextToSize(line, bw).forEach((part) => {
                    y += 4.5;
                    doc.text(part, sx, y);
                });
            });
    }

    // ---------- Footer on every page ----------
    const pages = doc.getNumberOfPages();
    const footerY = lhFooter ? contentBottom - 1.5 : pageH - 8;
    for (let i = 1; i <= pages; i++) {
        doc.setPage(i);
        if (!lhFooter) {
            doc.setDrawColor(...LINE);
            doc.setLineWidth(0.3);
            doc.line(MARGIN, pageH - 13, pageW - MARGIN, pageH - 13);
        }
        doc.setFont("helvetica", "normal");
        doc.setFontSize(lhFooter ? 7 : 8);
        doc.setTextColor(...MUTED);
        doc.text(
            `Bill ${txt(bill.bill_no)} · Computer generated`,
            MARGIN,
            footerY,
        );
        doc.text(`Page ${i} of ${pages}`, pageW - MARGIN, footerY, {
            align: "right",
        });
    }

    const filename = `${txt(bill.bill_no) || "bill"}.pdf`;
    if (mode === "blob") return { blob: doc.output("blob"), filename };
    doc.save(filename);
    return null;
}
