import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor, fireEvent } from "@testing-library/react";

vi.mock("../utils/downloadConsultationPdf", () => ({
    downloadConsultationPdf: async () => {},
}));

import ResultView from "./ResultView";
import SuggestedPlanCard from "./SuggestedPlanCard";

let templateVersion = null;
beforeEach(() => {
    globalThis.fetch = vi.fn(async (url) => {
        const ok = (b) => ({ ok: true, json: async () => b });
        if (String(url).includes("/templates/")) return ok(templateVersion);
        if (String(url).endsWith("/me")) return ok({ role: "doctor", profile: {} });
        return ok({});
    });
});
afterEach(cleanup);

const doc = (extra = {}) => ({
    prescription: {
        diagnosis: [{ name: "Acute pharyngitis" }],
        symptoms: [{ name: "Sore throat" }],
        medications: [{ name: "Paracetamol 650 mg", brand: "Dolo 650" }],
        followup: [{ next_visit_duration: "3 days" }],
    },
    vitals: [{ name: "Body Weight", value: "70", units: "kgs" }],
    allergies: [{ name: "Dust" }],
    conditions: [{ name: "Asthma" }],
    consultation_summary: { overview: "", details: [] },
    ...extra,
});
const headings = () =>
    Array.from(document.querySelectorAll("h2,h3"))
        .map((h) => h.textContent.trim())
        .filter(Boolean);

describe("ResultView with templates", () => {
    it("renders legacy note with generic layout", () => {
        render(<ResultView result={{ structured_data: doc(), saved: { consultation_id: "c1" } }} onReset={() => {}} />);
        const h = headings();
        expect(h.indexOf("Vitals")).toBeLessThan(h.indexOf("Allergies"));
        expect(h.indexOf("Allergies")).toBeLessThan(h.indexOf("Conditions"));
        expect(screen.getByText("Prescribed today")).toBeTruthy();
    });

    it("uses template titles and order", async () => {
        templateVersion = {
            id: "t1",
            version: 1,
            name: "X",
            definition: {
                name: "X",
                sections: [
                    { id: "c", type: "conditions", title: "Past history" },
                    { id: "a", type: "allergies" },
                    { id: "d", type: "diagnosis" },
                ],
            },
        };
        render(
            <ResultView
                result={{ structured_data: doc({ template: { id: "t1", version: 1, name: "X" } }), saved: { consultation_id: "c1" } }}
                onReset={() => {}}
            />,
        );
        await waitFor(() => expect(screen.getByText("Past history")).toBeTruthy());
        const h = headings();
        expect(h.indexOf("Past history")).toBeLessThan(h.indexOf("Allergies"));
        expect(h).not.toContain("Vitals");
        expect(screen.queryByText("Prescribed today")).toBeNull();
    });
});

describe("Not recorded chips", () => {
    it("keep today's short names on a legacy note", () => {
        render(<ResultView result={{ structured_data: doc(), saved: { consultation_id: "c1" } }} onReset={() => {}} />);
        for (const name of ["Medications", "System review", "Family history", "Lifestyle", "Social history", "Other history"])
            expect(screen.getByText(`+ ${name}`)).toBeTruthy();
        expect(screen.queryByText("+ Medication History")).toBeNull();
    });

    it("use a template's own title when it renames a section", async () => {
        templateVersion = {
            id: "t2",
            version: 1,
            name: "Y",
            definition: { name: "Y", sections: [{ id: "m", type: "medication_history", title: "Current medicines" }] },
        };
        render(
            <ResultView
                result={{ structured_data: doc({ template: { id: "t2", version: 1, name: "Y" } }), saved: { consultation_id: "c1" } }}
                onReset={() => {}}
            />,
        );
        await waitFor(() => expect(screen.getByText("+ Current medicines")).toBeTruthy());
    });
});

describe("SuggestedPlanCard", () => {
    it("hides prescription and plan medicines when template lacks prescription", () => {
        const plan = {
            status: "pending",
            generated_at: "g",
            items: [
                { id: "m1", kind: "medication", name: "Amoxicillin 500 mg" },
                { id: "d1", kind: "diagnosis", name: "Acute otitis media" },
            ],
        };
        render(
            <SuggestedPlanCard
                consultationId="c1"
                plan={plan}
                allergies={[]}
                rx={{}}
                canEdit
                hasTranscript
                allowedKinds={["diagnosis", "followup"]}
                onChange={() => {}}
            />,
        );
        fireEvent.click(screen.getByText("AI suggested plan"));
        expect(screen.queryByText("Amoxicillin 500 mg")).toBeNull();
        expect(screen.getByText("Acute otitis media")).toBeTruthy();
    });
});
