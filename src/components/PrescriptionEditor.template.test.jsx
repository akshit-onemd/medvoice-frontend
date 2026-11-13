import React from "react";
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import PrescriptionEditor from "./PrescriptionEditor";

afterEach(cleanup);
const rx = { symptoms: [], medications: [], diagnosis: [], followup: [] };

describe("PrescriptionEditor parts", () => {
    it("shows every part by default", () => {
        render(<PrescriptionEditor consultationId="c1" prescription={rx} onSaved={() => {}} onCancel={() => {}} />);
        for (const t of ["Symptoms / complaints", "Medications", "Diagnosis", "Follow up"])
            expect(screen.getByText(t)).toBeTruthy();
    });

    it("leaves out parts the template doesn't have and uses renamed titles", () => {
        render(
            <PrescriptionEditor
                consultationId="c1"
                prescription={rx}
                parts={[
                    { type: "complaints", title: "Presenting symptoms" },
                    { type: "diagnosis", title: "Impression" },
                    { type: "followup", title: "Follow-up" },
                ]}
                onSaved={() => {}}
                onCancel={() => {}}
            />,
        );
        expect(screen.queryByText("Medications")).toBeNull();
        expect(screen.getByText("Impression")).toBeTruthy();
        expect(screen.getByText("Symptoms / complaints")).toBeTruthy();
        expect(screen.getByText("Follow up")).toBeTruthy();
    });
});
