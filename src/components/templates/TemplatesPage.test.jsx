import React from "react";
import { it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, waitFor, fireEvent, within } from "@testing-library/react";
import TemplatesPage from "./TemplatesPage";
import { forgetTemplateList } from "../TemplatePicker";

afterEach(cleanup);
it("set as default moves the badge at once and leaves other rows usable", async () => {
    forgetTemplateList();
    let release;
    globalThis.fetch = vi.fn(async (url, o) => {
        const ok = (b) => ({ ok: true, json: async () => b });
        if (String(url).endsWith("/templates") && (o?.method || "GET") === "GET")
            return ok({
                templates: [
                    { id: "g", name: "General OPD", builtin: true, isDefault: !release },
                    { id: "a", name: "Alpha", builtin: true, isDefault: !!release },
                    { id: "b", name: "Beta", builtin: true },
                ],
            });
        return new Promise((r) => (release = () => r(ok({ profile: {} }))));
    });
    render(<TemplatesPage />);
    await waitFor(() => expect(screen.getByText("Alpha")).toBeTruthy());
    const rowOf = (name) => screen.getByText(name).closest("li");
    fireEvent.click(within(rowOf("Alpha")).getByText("Set as default").closest("button"));
    expect(within(rowOf("Alpha")).getByText("Default")).toBeTruthy(); // no wait
    expect(within(rowOf("Beta")).getByText("Set as default").closest("button").disabled).toBe(false);
    await waitFor(() => expect(release).toBeTruthy());
    release();
    await waitFor(() => expect(within(rowOf("Alpha")).getByText("Default")).toBeTruthy());
});
