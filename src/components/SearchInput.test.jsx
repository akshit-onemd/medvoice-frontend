import React from "react";
import { it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import SearchInput from "./SearchInput";

afterEach(cleanup);
const setTouch = (touch) => {
    window.matchMedia = vi.fn((q) => ({ matches: q === "(pointer: coarse)" ? touch : false }));
};

it("doesn't grab focus on a phone, so the keyboard stays down", () => {
    setTouch(true);
    render(<SearchInput value="" onChange={() => {}} placeholder="Search or add a patient" autoFocus />);
    expect(document.activeElement).not.toBe(screen.getByPlaceholderText("Search or add a patient"));
});

it("still focuses on a computer", () => {
    setTouch(false);
    render(<SearchInput value="" onChange={() => {}} placeholder="Search or add a patient" autoFocus />);
    expect(document.activeElement).toBe(screen.getByPlaceholderText("Search or add a patient"));
});
