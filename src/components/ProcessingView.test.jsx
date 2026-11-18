import React from "react";
import { it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import ProcessingView from "./ProcessingView";

afterEach(cleanup);

it("shows the four steps, no heading or file name", () => {
    render(<ProcessingView currentStage={1} fileName="Amit K - Hindi.mp3" />);
    const steps = screen.getAllByRole("listitem").map((li) => li.textContent);
    expect(steps.map((s) => s.replace("This can take a little while.", "").replace(/^\d/, "").trim())).toEqual([
        "Uploading recording",
        "Processing recording",
        "Extracting clinical details",
        "Preparing your summary",
    ]);
    expect(screen.queryByText("Reading the consultation")).toBeNull();
    expect(screen.queryByText("Amit K - Hindi.mp3")).toBeNull();
});
