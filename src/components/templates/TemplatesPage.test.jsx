import React from "react";
import { it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, waitFor, fireEvent } from "@testing-library/react";
import TemplatesPage from "./TemplatesPage";

afterEach(cleanup);
it("only the clicked row waits while an action runs", async () => {
    let release;
    globalThis.fetch = vi.fn(async (url, o) => {
        const ok = (b) => ({ ok: true, json: async () => b });
        if (String(url).endsWith("/templates") && (o?.method || "GET") === "GET")
            return ok({
                templates: [
                    { id: "g", name: "General OPD", builtin: true, isDefault: true },
                    { id: "a", name: "Alpha", builtin: true },
                    { id: "b", name: "Beta", builtin: true },
                ],
            });
        return new Promise((r) => (release = () => r(ok({ profile: {} }))));
    });
    render(<TemplatesPage />);
    await waitFor(() => expect(screen.getByText("Alpha")).toBeTruthy());
    const [setA, setB] = screen.getAllByText("Set as default").map((el) => el.closest("button"));
    fireEvent.click(setA);
    await waitFor(() => expect(screen.getByText("Setting…")).toBeTruthy());
    expect(screen.getByText("Setting…").closest("button").disabled).toBe(true);
    expect(setB.disabled).toBe(false);
    expect(screen.getAllByText("Add to my templates").every((el) => !el.closest("button").disabled || el.closest("li").textContent.includes("Alpha"))).toBe(true);
    release();
    await waitFor(() => expect(screen.queryByText("Setting…")).toBeNull());
});
