import React, { useState } from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor, fireEvent } from "@testing-library/react";
import TemplatePicker, { forgetTemplateList, rememberTemplate } from "./TemplatePicker";

const LIST = [
    { id: "g", name: "General OPD", builtin: true, isDefault: true, specialty: "General Medicine", kind: "new" },
    { id: "h", name: "Hypothyroidism", builtin: true, specialty: "Endocrinology", kind: "condition" },
    { id: "y", name: "Hyperthyroidism", builtin: true, specialty: "Endocrinology", kind: "condition" },
    { id: "d", name: "Diabetes Follow-up", builtin: true, specialty: "Endocrinology", kind: "follow_up" },
    { id: "m", name: "My sugar clinic", builtin: false, kind: "follow_up" },
];
beforeEach(() => {
    forgetTemplateList();
    localStorage.clear();
    Element.prototype.scrollIntoView = () => {};
    globalThis.fetch = vi.fn(async () => ({ ok: true, json: async () => ({ templates: LIST }) }));
});
afterEach(cleanup);
function Harness({ onPick }) {
    const [v, setV] = useState("");
    return <TemplatePicker value={v} onChange={(id) => (setV(id), onPick?.(id))} />;
}
const options = () => screen.getAllByRole("option").map((o) => o.textContent);

describe("TemplatePicker", () => {
    it("starts on the default and filters as you type", async () => {
        render(<Harness />);
        await waitFor(() => expect(screen.getByText("General OPD")).toBeTruthy());
        fireEvent.click(screen.getByRole("button", { expanded: false }));
        fireEvent.change(screen.getByPlaceholderText("Search templates"), { target: { value: "thy" } });
        expect(options().length).toBe(2);
        fireEvent.change(screen.getByPlaceholderText("Search templates"), { target: { value: "follow" } });
        expect(options().map((t) => t.split("Endo")[0].split("My template")[0])).toEqual(["Diabetes Follow-up", "My sugar clinic"]);
    });

    it("picks with the keyboard", async () => {
        const picked = [];
        render(<Harness onPick={(id) => picked.push(id)} />);
        await waitFor(() => expect(screen.getByText("General OPD")).toBeTruthy());
        fireEvent.click(screen.getByRole("button", { expanded: false }));
        const box = screen.getByPlaceholderText("Search templates");
        fireEvent.change(box, { target: { value: "hyper" } });
        fireEvent.keyDown(box, { key: "Enter" });
        expect(picked.at(-1)).toBe("y");
        expect(screen.queryByPlaceholderText("Search templates")).toBeNull();
    });

    it("shows recent templates first", async () => {
        rememberTemplate("h");
        rememberTemplate("d");
        render(<Harness />);
        await waitFor(() => expect(screen.getByText("General OPD")).toBeTruthy());
        fireEvent.click(screen.getByRole("button", { expanded: false }));
        expect(screen.getByText("Recent")).toBeTruthy();
        expect(options()[0]).toContain("Diabetes Follow-up");
        expect(options()[1]).toContain("Hypothyroidism");
        expect(options()[2]).toContain("General OPD");
    });
});
