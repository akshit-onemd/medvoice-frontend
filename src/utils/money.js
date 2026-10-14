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
