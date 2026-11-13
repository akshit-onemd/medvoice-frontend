import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor, fireEvent } from "@testing-library/react";

vi.mock("../utils/downloadConsultationPdf", () => ({ downloadConsultationPdf: async () => {} }));
import ResultView from "./ResultView";
import TemplateEditor from "./templates/TemplateEditor";
import TemplatesPage from "./templates/TemplatesPage";

const def = {
    name: "Diabetes follow-up",
    sections: [
        { id: "glycaemic", type: "values", title: "Glycaemic profile", fields: [{ key: "hba1c", label: "HbA1c", unit: "%" }] },
        { id: "hypos", type: "choice", title: "Hypos", options: ["None", "Mild"], multiple: false },
        { id: "eyes", type: "checklist", title: "Screening", items: ["Retinopathy"] },
        { id: "diagnosis", type: "diagnosis" },
    ],
};
let calls = [];
beforeEach(() => {
    calls = [];
    globalThis.fetch = vi.fn(async (url, opts) => {
        calls.push([String(url), opts?.method || "GET", opts?.body]);
        const ok = (b) => ({ ok: true, json: async () => b });
        if (String(url).includes("/versions/")) return ok({ id: "t1", version: 1, name: def.name, definition: def });
        if (String(url).endsWith("/templates"))
            return ok({ templates: [{ id: "g", name: "General OPD", builtin: true, isDefault: true, specialty: "General Medicine" }] });
        if (String(url).includes("/custom/")) return ok({ custom: { glycaemic: { hba1c: "7.4" } } });
        return ok({});
    });
});
afterEach(cleanup);

describe("template's own sections", () => {
    it("shows filled ones as cards and empty ones as chips, and saves edits", async () => {
        const sd = {
            template: { id: "t1", version: 1, name: def.name },
            prescription: { diagnosis: [{ name: "Type 2 diabetes" }] },
            custom: { glycaemic: { hba1c: "8.2" }, hypos: { selected: [] } },
            consultation_summary: { overview: "", details: [] },
        };
        render(<ResultView result={{ structured_data: sd, saved: { consultation_id: "c1" }, transcript: "x".repeat(50) }} onReset={() => {}} />);
        await waitFor(() => expect(screen.getByText("Glycaemic profile")).toBeTruthy());
        expect(screen.getByText("8.2")).toBeTruthy();
        expect(screen.getByText("+ Hypos")).toBeTruthy();
        expect(screen.getByText("Change")).toBeTruthy();
        fireEvent.click(screen.getByLabelText("Edit Glycaemic profile"));
        const input = screen.getByDisplayValue("8.2");
        fireEvent.change(input, { target: { value: "7.4" } });
        fireEvent.click(screen.getByText("Save changes"));
        await waitFor(() => expect(screen.getByText("7.4")).toBeTruthy());
        const put = calls.find((c) => c[0].includes("/custom/glycaemic"));
        expect(JSON.parse(put[2]).value.hba1c).toBe("7.4");
    });

    it("hides Change template for report-only visits", async () => {
        render(<ResultView result={{ structured_data: { consultation_summary: {} }, saved: { consultation_id: "c1" } }} onReset={() => {}} />);
        expect(screen.queryByText("Change")).toBeNull();
    });

    it("editor adds a section and previews it", () => {
        render(<TemplateEditor initial={def} onSaved={() => {}} onCancel={() => {}} />);
        fireEvent.change(screen.getByDisplayValue("Add a section…"), { target: { value: "score" } });
        fireEvent.click(screen.getByText("Add"));
        expect(screen.getAllByDisplayValue("Score").length).toBeGreaterThan(0);
    });

    it("templates page lists the library", async () => {
        render(<TemplatesPage />);
        await waitFor(() => expect(screen.getByText("General OPD")).toBeTruthy());
        expect(screen.getByText("Default")).toBeTruthy();
    });
});
