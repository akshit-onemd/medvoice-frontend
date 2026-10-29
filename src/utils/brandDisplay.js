// One medicine, two lines: the brand on top when there is one, the generic below it.
// { name: "Metformin 500 mg", brand: "Glycomet 500 mg" } -> { primary: "Glycomet 500 mg", secondary: "Metformin 500 mg" }
// No brand: the generic is the primary line and there is no second line.
export const medLines = (m) => {
    const name = String(m?.name ?? "").trim();
    const brand = String(m?.brand ?? "").trim();
    if (brand && brand.toLowerCase() !== name.toLowerCase())
        return { primary: brand, secondary: name };
    return { primary: name || brand, secondary: "" };
};
