import React from "react";
import { it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import TemplatesPage from "../components/templates/TemplatesPage";
import PatientList from "../components/PatientList";
import { forgetTemplateList } from "../components/TemplatePicker";

afterEach(cleanup);
const ok = (b) => ({ ok: true, json: async () => b });

it("templates and patients show at once on a second visit, then refresh quietly", async () => {
    forgetTemplateList();
    let calls = 0;
    globalThis.fetch = vi.fn(async (url) => {
        calls++;
        if (String(url).includes("/templates")) return ok({ templates: [{ id: "g", name: "General OPD", builtin: true, isDefault: true }] });
        if (String(url).includes("/patients")) return ok({ patients: [{ id: "p1", name: "Ramesh", phone: "1", visit_count: 1 }], hasMore: false });
        return ok({});
    });
    const a = render(<TemplatesPage />);
    expect(screen.getByText(/Loading/)).toBeTruthy();
    await waitFor(() => expect(screen.getByText("General OPD")).toBeTruthy());
    a.unmount();
    render(<TemplatesPage />);
    expect(screen.getByText("General OPD")).toBeTruthy(); // no loading step
    expect(screen.queryByText(/Loading/)).toBeNull();
    cleanup();

    const b = render(<PatientList />);
    await waitFor(() => expect(screen.getByText("Ramesh")).toBeTruthy());
    b.unmount();
    render(<PatientList />);
    expect(screen.getByText("Ramesh")).toBeTruthy();
    await waitFor(() => expect(calls).toBe(4)); // still refreshed in the background
});
