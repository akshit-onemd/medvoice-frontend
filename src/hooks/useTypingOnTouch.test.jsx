import React from "react";
import { it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, act, fireEvent } from "@testing-library/react";
import useTypingOnTouch from "./useTypingOnTouch";

afterEach(cleanup);
function Probe({ autoFocus = false }) {
    const t = useTypingOnTouch();
    return (
        <div>
            <input aria-label="field" autoFocus={autoFocus} />
            <input aria-label="other" />
            <button>btn</button>
            <span>{t ? "typing" : "idle"}</span>
        </div>
    );
}
const tick = () => act(async () => new Promise((r) => setTimeout(r, 5)));

it("a field focused on page load doesn't count, tapping it does", async () => {
    window.matchMedia = vi.fn(() => ({ matches: true }));
    render(<Probe autoFocus />);
    expect(document.activeElement).toBe(screen.getByLabelText("field"));
    expect(screen.getByText("idle")).toBeTruthy(); // no keyboard yet on iOS
    fireEvent.pointerDown(screen.getByLabelText("field"));
    fireEvent.click(screen.getByLabelText("field")); // the tap that opens the keyboard
    expect(screen.getByText("typing")).toBeTruthy();
    act(() => screen.getByText("btn").focus());
    await tick();
    expect(screen.getByText("idle")).toBeTruthy();
});

it("moving focus into a field counts", async () => {
    window.matchMedia = vi.fn(() => ({ matches: true }));
    render(<Probe />);
    act(() => screen.getByLabelText("field").focus());
    expect(screen.getByText("typing")).toBeTruthy();
});

it("a scroll that starts with a finger on a field does not hide the bar", () => {
    window.matchMedia = vi.fn(() => ({ matches: true }));
    render(<Probe />);
    // finger lands on a field, then the page scrolls: no focus, no click
    fireEvent.pointerDown(screen.getByLabelText("other"));
    fireEvent.pointerCancel(screen.getByLabelText("other"));
    fireEvent.scroll(window);
    expect(screen.getByText("idle")).toBeTruthy();
});

it("scrolling brings the bar back if nothing is focused any more", () => {
    window.matchMedia = vi.fn(() => ({ matches: true }));
    render(<Probe />);
    act(() => screen.getByLabelText("field").focus());
    expect(screen.getByText("typing")).toBeTruthy();
    // field lost focus without a focusout we saw (e.g. removed from the page)
    act(() => { document.activeElement.blur(); });
    fireEvent.scroll(window);
    expect(screen.getByText("idle")).toBeTruthy();
});
