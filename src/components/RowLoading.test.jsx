import React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, waitFor, fireEvent } from "@testing-library/react";
import SuggestedPlanCard from "./SuggestedPlanCard";
import CodeReviewPanel from "./CodeReviewPanel";

afterEach(cleanup);
const never = () => new Promise(() => {});

describe("only the clicked item waits", () => {
    it("starring a brand in the AI plan keeps the rest usable", async () => {
        globalThis.fetch = vi.fn(async (url, o) => {
            const ok = (b) => ({ ok: true, json: async () => b });
            if (String(url).includes("/brands/lookup"))
                return ok({ results: [{ id: "m1", ingKey: "phenazopyridine", brands: [{ name: "Pyridium 100", family: "pyridium" }, { name: "Urispas", family: "urispas" }] }] });
            if (String(url).includes("/brand-prefs/favourite")) return never();
            return ok({});
        });
        const plan = {
            status: "pending",
            generated_at: "t",
            items: [
                { id: "m1", kind: "medication", name: "Phenazopyridine 100 mg" },
                { id: "d1", kind: "diagnosis", name: "Urinary tract infection" },
            ],
        };
        render(<SuggestedPlanCard consultationId="c1" plan={plan} rx={{}} canEdit hasTranscript onChange={() => {}} />);
        const expand = screen.queryByText(/Show more/);
        if (expand) fireEvent.click(expand);
        await waitFor(() => expect(screen.getByLabelText("Favourite Pyridium 100")).toBeTruthy());
        fireEvent.click(screen.getByLabelText("Favourite Pyridium 100"));
        await waitFor(() => expect(screen.getByLabelText("Favourite Pyridium 100").disabled).toBe(true));
        expect(screen.getByLabelText("Favourite Urispas").disabled).toBe(false);
        expect(screen.getByText("Pyridium 100").closest("button").disabled).toBe(false);
        screen.getAllByRole("checkbox").forEach((c) => expect(c.disabled).toBe(false));
    });

    it("confirming one code leaves the other rows usable", async () => {
        globalThis.fetch = vi.fn(async () => never());
        const items = [
            { id: "a", term: "Fever", label: "Symptom", vocab: "snomed", code: "386661006", status: "review", path: "p.a" },
            { id: "b", term: "Cough", label: "Symptom", vocab: "snomed", code: "49727002", status: "review", path: "p.b" },
        ];
        render(<CodeReviewPanel items={items} canEdit consultationId="c1" onChanged={() => {}} onPick={() => {}} />);
        fireEvent.click(screen.getByText("Codes to review"));
        const [c1, c2] = screen.getAllByText("Confirm").map((el) => el.closest("button"));
        fireEvent.click(c1);
        await waitFor(() => expect(screen.getByText("Saving…")).toBeTruthy());
        expect(c2.disabled).toBe(false);
        expect(screen.getAllByText("Change").map((el) => el.closest("button").disabled)).toEqual([true, false]);
    });
});
