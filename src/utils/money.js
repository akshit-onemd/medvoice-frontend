export const money = (n) =>
    "₹" +
    Number(n).toLocaleString("en-IN", {
        minimumFractionDigits: Number.isInteger(Number(n)) ? 0 : 2,
        maximumFractionDigits: 2,
    });

export const r2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

export function lineAmounts(fee, qty, rate) {
    const base = r2(fee * qty);
    const tax = r2((base * (rate || 0)) / 100);
    return { base, tax, total: r2(base + tax) };
}
// b.items: [{ fee, qty, tax_id }]. qty: how many bundles.
export function bundleAmounts(b, qty, taxById) {
    let unit = 0;
    let base = 0;
    let tax = 0;
    for (const m of b.items) {
        const a = lineAmounts(m.fee, m.qty * qty, taxById[m.tax_id]?.rate);
        unit = r2(unit + m.fee * m.qty);
        base += a.base;
        tax += a.tax;
    }
    return { unit: r2(unit), base: r2(base), tax: r2(tax), total: r2(base + tax) };
}