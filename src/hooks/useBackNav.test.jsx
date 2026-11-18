import React, { useState } from "react";
import { it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, act, fireEvent } from "@testing-library/react";
import useBackNav, { useBackLayer } from "./useBackNav";

afterEach(cleanup);

const pressBack = () =>
    act(() => {
        window.dispatchEvent(new PopStateEvent("popstate", { state: null }));
    });

function Scanner({ onClose }) {
    useBackLayer(true, () => {
        onClose();
        return "stay";
    });
    return <p>camera</p>;
}

function App({ onBack }) {
    const [scan, setScan] = useState(false);
    const prompt = useBackNav({
        active: true,
        warnOnUnload: false,
        onBack,
    });
    return (
        <div>
            <button onClick={() => setScan(true)}>Scan pages</button>
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

it("arms the guard on load, once", () => {
    const push = vi.spyOn(window.history, "pushState");
    render(<App onBack={leaveApp} />);
    expect(push).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByText("Scan pages"));
    expect(push).toHaveBeenCalledTimes(1);
    push.mockRestore();
});

it("re-arms on the next tap after leaving was cancelled by the browser", () => {
    const go = vi.spyOn(window.history, "go").mockImplementation(() => {});
    vi.useFakeTimers();
    render(<App onBack={() => "leave"} />);
    pressBack(); // leave: nothing earlier in history, so we stay here
    act(() => vi.advanceTimersByTime(1500));
    const push = vi.spyOn(window.history, "pushState");
    fireEvent.click(screen.getByText("Scan pages"));
    expect(push).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
    push.mockRestore();
    go.mockRestore();
});

it("Back with an open scanner closes the scanner, not the app", () => {
    const go = vi.spyOn(window.history, "go").mockImplementation(() => {});
    render(<App onBack={leaveApp} />);
    fireEvent.click(screen.getByText("Scan pages"));
    expect(screen.getByText("camera")).toBeTruthy();
    pressBack();
    expect(screen.queryByText("camera")).toBeNull();
    expect(screen.queryByText("Leave OneMD?")).toBeNull();
    expect(go).not.toHaveBeenCalled();
    go.mockRestore();
});

it("Back on the home screen asks before leaving; Stay keeps you in", () => {
    const go = vi.spyOn(window.history, "go").mockImplementation(() => {});
    render(<App onBack={leaveApp} />);
    fireEvent.click(document.body);
    pressBack();
    expect(screen.getByText("Leave OneMD?")).toBeTruthy();
    fireEvent.click(screen.getByText("Stay"));
    expect(screen.queryByText("Leave OneMD?")).toBeNull();
    expect(go).not.toHaveBeenCalled();
    go.mockRestore();
});

it("confirming Leave goes back past the guard", () => {
    const go = vi.spyOn(window.history, "go").mockImplementation(() => {});
    render(<App onBack={leaveApp} />);
    fireEvent.click(document.body);
    pressBack();
    fireEvent.click(screen.getByText("Leave"));
    expect(go).toHaveBeenCalledWith(-2);
    go.mockRestore();
});

it("Back while the leave prompt is open just closes the prompt", () => {
    const go = vi.spyOn(window.history, "go").mockImplementation(() => {});
    render(<App onBack={leaveApp} />);
    fireEvent.click(document.body);
    pressBack();
    pressBack();
    expect(screen.queryByText("Leave OneMD?")).toBeNull();
    expect(go).not.toHaveBeenCalled();
    go.mockRestore();
});
