import React from "react";
import { it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import PatientRecords from "./PatientRecords";
import { forgetPatientCache } from "../api/patientCache";

vi.mock("./ResultView", () => ({ default: ({ result }) => <p>note {result.structured_data.id}</p> }));

const VISITS = [{ id: "c1", created_at: "2026-11-17T10:00:00Z", summary: "Diabetes" }];
let calls;
beforeEach(() => {
    forgetPatientCache();
    calls = [];
    globalThis.fetch = vi.fn(async (url) => {
        calls.push(url);
        if (url.endsWith("/consultations")) return { ok: true, json: async () => ({ consultations: VISITS }) };
        if (url.endsWith("/summary")) return { ok: true, json: async () => ({ patient_summary: { overview: "Type 2 diabetes, on metformin", details: [] } }) };
        if (url.includes("/consultations/")) return { ok: true, json: async () => ({ structured_data: { id: url.split("/").pop() } }) };
        return { ok: true, json: async () => ({}) };
    });
});
afterEach(cleanup);

const patient = { id: "p1", name: "Amit K", age: 52, gender: "male", phone: "9820098200" };

it("reopening a patient shows the summary and visits at once", async () => {
    const first = render(<PatientRecords patient={patient} onBack={() => {}} onNewVisit={() => {}} />);
    await waitFor(() => expect(screen.getByText("Diabetes")).toBeTruthy());
    first.unmount();
    render(<PatientRecords patient={patient} onBack={() => {}} onNewVisit={() => {}} />);
    expect(screen.queryByText("Loading records…")).toBeNull();
    expect(screen.queryByText("Loading summary…")).toBeNull();
    expect(screen.getByText("Diabetes")).toBeTruthy();
});

it("the latest visits are loaded in the background, so opening one is instant", async () => {
    render(<PatientRecords patient={patient} onBack={() => {}} onNewVisit={() => {}} />);
    await waitFor(() => expect(calls.some((u) => u.endsWith("/consultations/c1"))).toBe(true));
    const n = calls.length;
    screen.getByText("Diabetes").closest("button").click();
    await waitFor(() => expect(screen.getByText("note c1")).toBeTruthy());
    expect(calls.length).toBe(n);
});
