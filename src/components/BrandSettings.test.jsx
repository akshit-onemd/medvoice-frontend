import React from "react";
import { it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, waitFor, fireEvent, act } from "@testing-library/react";
import BrandSettings from "./BrandSettings";
afterEach(cleanup);

it("a brand found by name can be starred and saved", async () => {
    const calls = [];
    const fams = Array.from({ length: 80 }, (_, i) => ({ family: `brand${i}`, sample: `Brand${i} 500`, manufacturer: "X", strengths: ["500"] }));
    fams.unshift({ family: "janumet", sample: "Janumet 1000/50", manufacturer: "MSD", strengths: ["1000/50"] });
    globalThis.fetch = vi.fn(async (url, o) => {
        calls.push([String(url), o?.method, o?.body]);
        const ok = (b) => ({ ok: true, json: async () => b });
        if (String(url).includes("/brand-prefs") && o?.method === "GET") return ok({ prefs: [] });
        if (String(url).includes("/brands/medicines"))
            return ok({ results: [{ ing_key: "metformin+sitagliptin", label: "Metformin + Sitagliptin", matched_brand: "Janumet 1000/50", brand_count: 208 }] });
        if (String(url).includes("/brands/families")) return ok({ label: "Metformin + Sitagliptin", families: fams });
        return ok({ ok: true });
    });
    render(<BrandSettings />);
    fireEvent.change(screen.getByPlaceholderText(/Search a medicine/), { target: { value: "janumet" } });
    await waitFor(() => expect(screen.getByText("brand: Janumet 1000/50")).toBeTruthy(), { timeout: 2000 });
    fireEvent.click(screen.getByText("brand: Janumet 1000/50").closest("button"));
    await waitFor(() => expect(screen.getByDisplayValue("Janumet")).toBeTruthy());
    const fam = calls.find((c) => c[0].includes("/brands/families"))[0];
    expect(fam).toContain("brand=Janumet%201000%2F50");
    expect(fam).toContain("ing=metformin%2Bsitagliptin");
    fireEvent.click(screen.getByText("Janumet 1000/50").closest("button"));
    fireEvent.click(screen.getByText("Save"));
    await waitFor(() => expect(calls.some((c) => c[1] === "PUT")).toBe(true));
    const put = calls.find((c) => c[1] === "PUT");
    expect(JSON.parse(put[2])).toEqual({ ing_key: "metformin+sitagliptin", families: ["janumet"] });
});
