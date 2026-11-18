import React, { useState } from "react";
import { it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, act, fireEvent } from "@testing-library/react";
import useBackNav, { useBackLayer } from "./useBackNav";

afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
});

const guardDepth = () => window.history.state?.appBackGuard || 0;

// A real Back: the browser moves one entry back and fires popstate
const pressBack = async () => {
    await act(async () => {
        window.history.back();
        await new Promise((r) => setTimeout(r, 30));
    });
};

function Scanner({ onClose }) {
    useBackLayer(true, () => {
        onClose();
        return "stay";
    });
    return <p>camera</p>;
}

function App({ onBack }) {
    const [scan, setScan] = useState(false);
    const prompt = useBackNav({ active: true, warnOnUnload: false, onBack });
    return (
        <div>
            <button onClick={() => setScan(true)}>Scan pages</button>
            <button>other</button>
            {scan && <Scanner onClose={() => setScan(false)} />}
            {prompt}
        </div>
    );
}

const leaveApp = () => ({
    title: "Leave OneMD?",
    message: "You'll exit the app.",
    confirmLabel: "Leave",
    onConfirm: () => "leave",
});

it("adds history entries only on a tap, never on load", () => {
    const push = vi.spyOn(window.history, "pushState");
    render(<App onBack={leaveApp} />);
    expect(push).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText("other"));
    expect(push).toHaveBeenCalledTimes(2); // two spare Back presses
    fireEvent.click(screen.getByText("other"));
    expect(push).toHaveBeenCalledTimes(2); // already topped up
});

it("Back with an open scanner closes the scanner, not the app", async () => {
    const go = vi.spyOn(window.history, "go");
    render(<App onBack={leaveApp} />);
    fireEvent.click(screen.getByText("Scan pages"));
    expect(screen.getByText("camera")).toBeTruthy();
    await pressBack();
    expect(screen.queryByText("camera")).toBeNull();
    expect(screen.queryByText("Leave OneMD?")).toBeNull();
    expect(go).not.toHaveBeenCalled();
});

it("Back never adds history entries itself (browsers skip those)", async () => {
    render(<App onBack={leaveApp} />);
    fireEvent.click(screen.getByText("other"));
    const push = vi.spyOn(window.history, "pushState");
    await pressBack();
    expect(screen.getByText("Leave OneMD?")).toBeTruthy();
    expect(push).not.toHaveBeenCalled();
});

it("two quick Backs without a tap in between are both caught", async () => {
    const onBack = vi.fn(() => "stay");
    render(<App onBack={onBack} />);
    fireEvent.click(screen.getByText("other"));
    await pressBack();
    await pressBack();
    expect(onBack).toHaveBeenCalledTimes(2);
});

it("Stay keeps you in and the next tap re-protects", async () => {
    const go = vi.spyOn(window.history, "go");
    render(<App onBack={leaveApp} />);
    fireEvent.click(screen.getByText("other"));
    const top = guardDepth();
    await pressBack();
    expect(guardDepth()).toBe(top - 1);
    fireEvent.click(screen.getByText("Stay"));
    expect(screen.queryByText("Leave OneMD?")).toBeNull();
    expect(guardDepth()).toBe(top);
    expect(go).not.toHaveBeenCalled();
});

it("Leave goes back past every guard entry", async () => {
    render(<App onBack={leaveApp} />);
    fireEvent.click(screen.getByText("other"));
    await pressBack();
    const go = vi.spyOn(window.history, "go").mockImplementation(() => {});
    fireEvent.click(screen.getByText("Leave"));
    expect(go).toHaveBeenCalledWith(-(guardDepth() + 1));
});

it("Back while the leave prompt is open just closes the prompt", async () => {
    const go = vi.spyOn(window.history, "go");
    render(<App onBack={leaveApp} />);
    fireEvent.click(screen.getByText("other"));
    await pressBack();
    expect(screen.getByText("Leave OneMD?")).toBeTruthy();
    await pressBack();
    expect(screen.queryByText("Leave OneMD?")).toBeNull();
    expect(go).not.toHaveBeenCalled();
});
