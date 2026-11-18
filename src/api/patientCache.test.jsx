import React from "react";
import { it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import { authFetch } from "./processAudio";
import { usePatientVisits, loadConsultation, prefetchConsultations, forgetPatientCache } from "./patientCache";

const VISITS = [{ id: "c1", created_at: "2026-11-17" }, { id: "c2", created_at: "2026-11-10" }];
let calls;
beforeEach(() => {
    forgetPatientCache();
    calls = [];
    globalThis.fetch = vi.fn(async (url, opts = {}) => {
        calls.push(`${opts.method || "GET"} ${url}`);
        if (url.endsWith("/consultations")) return { ok: true, json: async () => ({ consultations: VISITS }) };
        if (url.includes("/consultations/")) return { ok: true, json: async () => ({ structured_data: { id: url.split("/").pop() } }) };
        return { ok: true, json: async () => ({}) };
    });
});
afterEach(cleanup);

function Visits({ id }) {
    const { data, loading } = usePatientVisits(id);
    return <p>{loading ? "loading" : data.map((v) => v.id).join(",")}</p>;
}

it("shows a patient's visits at once on the second open, refreshing quietly", async () => {
    const first = render(<Visits id="p1" />);
    expect(screen.getByText("loading")).toBeTruthy();
    await waitFor(() => expect(screen.getByText("c1,c2")).toBeTruthy());
    first.unmount();
    render(<Visits id="p1" />);
    expect(screen.getByText("c1,c2")).toBeTruthy(); // no loading state
    await waitFor(() => expect(calls.filter((c) => c.endsWith("/patients/p1/consultations")).length).toBe(2));
});

it("a prefetched consultation opens without another request", async () => {
    await prefetchConsultations(["c1"]);
    const n = calls.length;
    const full = await loadConsultation("c1");
    expect(full.structured_data.id).toBe("c1");
    expect(calls.length).toBe(n);
});

it("any change saved to the server drops cached consultations", async () => {
    await loadConsultation("c1");
    await authFetch("/api/consultations/c1/prescription", { method: "PUT" });
    const n = calls.length;
    await loadConsultation("c1");
    expect(calls.length).toBe(n + 1);
});
