import { describe, it, expect } from "vitest";
import { layoutFor } from "./templateLayout";

describe("layoutFor", () => {
    it("gives today's generic order and titles when no template", () => {
        const l = layoutFor(undefined);
        expect(l.rx.map((p) => [p.type, p.title])).toEqual([
            ["diagnosis", "Diagnosis"],
            ["complaints", "Presenting symptoms"],
            ["prescription", "Prescribed today"],
            ["followup", "Follow-up"],
        ]);
        expect(l.cards.map((c) => c.key)).toEqual([
            "vitals",
            "allergies",
            "conditions",
            "medication_history",
            "investigation_history",
            "procedures",
            "system_review",
            "family_history",
            "lifestyle_habits",
            "social_history",
            "other_history",
        ]);
        expect(l.has("prescription")).toBe(true);
    });

    it("follows a template's order and titles and leaves out the rest", () => {
        const l = layoutFor({
            name: "X",
            sections: [
                { id: "c", type: "conditions", title: "Past history" },
                { id: "a", type: "allergies" },
                { id: "f", type: "followup", title: "Review" },
            ],
        });
        expect(l.cards).toEqual([
            { type: "conditions", key: "conditions", title: "Past history" },
            { type: "allergies", key: "allergies", title: "Allergies" },
        ]);
        expect(l.rx).toEqual([{ type: "followup", title: "Review" }]);
        expect(l.has("prescription")).toBe(false);
        expect(l.has("vitals")).toBe(false);
    });
});
