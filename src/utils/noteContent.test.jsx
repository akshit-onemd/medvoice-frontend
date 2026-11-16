import React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { noteHasContent } from "./noteContent";

vi.mock("./downloadConsultationPdf", () => ({ downloadConsultationPdf: async () => {} }));
import ResultView from "../components/ResultView";
afterEach(cleanup);

const blankVitals = [{ name: "Body Weight", value: "", units: "kgs", loinc_code: "29463-7" }];
describe("noteHasContent", () => {
    it("is false for a blank note", () => {
        expect(noteHasContent({})).toBe(false);
        expect(
            noteHasContent({
                vitals: blankVitals,
                allergies: [{ name: "", notes: "", snomed_ct_code: "x" }],
                prescription: { symptoms: [], medications: [{ name: "", dosage: [] }] },
                custom: { eyes: [{ item: "Retinopathy", status: "", note: "" }], hypos: { selected: [] } },
                consultation_summary: { overview: "Noise only", details: [] },
            }),
        ).toBe(false);
    });
    it("is true once anything is filled", () => {
        expect(noteHasContent({ vitals: [{ ...blankVitals[0], value: "70" }] })).toBe(true);
        expect(noteHasContent({ prescription: { diagnosis: [{ name: "Fever" }] } })).toBe(true);
        expect(noteHasContent({ custom: { eyes: [{ item: "Retinopathy", status: "no", note: "" }] } })).toBe(true);
    });
});

it("an empty note can't be downloaded or billed", () => {
    globalThis.fetch = vi.fn(async () => ({ ok: true, json: async () => ({}) }));
    render(<ResultView result={{ structured_data: { vitals: blankVitals }, saved: { consultation_id: "c1" } }} onReset={() => {}} />);
    expect(screen.getByText("Download PDF").closest("button").disabled).toBe(true);
    expect(screen.getByText("Create Bill").closest("button").disabled).toBe(true);
});
