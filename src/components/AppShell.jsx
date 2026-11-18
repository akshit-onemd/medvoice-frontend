import React from "react";
import { UserButton } from "@clerk/react";
import BrandMark from "./BrandMark";
import useTypingOnTouch from "../hooks/useTypingOnTouch";

// The frame around every signed-in screen.
// Desktop: a navy sidebar with the brand, the main destinations and the account.
// Phone: a slim brand bar on top and a thumb-reach tab bar at the bottom.
//
// nav: [{ key, label, icon, active, onClick }]
export default function AppShell({
    nav,
    onHome,
    disabled = false,
    accountName = "",
    accountNote = "",
    children,
}) {
    // While the keyboard is up the tab bar is hidden, so it can't sit on top of the keyboard
    const typing = useTypingOnTouch();
    return (
        <div className="min-h-screen bg-paper">
            {/* Desktop sidebar */}
            <aside className="fixed inset-y-0 left-0 z-40 hidden w-[248px] flex-col bg-ink text-white lg:flex">
                <button
                    type="button"
                    onClick={onHome}
                    disabled={disabled}
                    aria-label="Go to home"
                    className="flex items-center gap-2.5 px-5 pb-5 pt-6 text-left"
                >
                    <BrandMark size={36} />
                    <span className="font-display text-[22px] leading-none text-white">
                        OneMD
                    </span>
                </button>
                <nav aria-label="Main" className="flex-1 px-3">
                    <ul className="space-y-1">
                        {nav.map((item) => (
                            <li key={item.key}>
                                <button
                                    type="button"
                                    onClick={item.onClick}
                                    disabled={disabled}
                                    aria-current={
                                        item.active ? "page" : undefined
                                    }
                                    className={`flex w-full items-center gap-3 rounded px-3 py-2.5 text-left text-[15px] transition-colors disabled:opacity-40 ${
                                        item.active
                                            ? "bg-white/[0.12] font-medium text-white"
                                            : "text-white/65 hover:bg-white/[0.06] hover:text-white"
                                    }`}
                                >
                                    <item.icon
                                        size={18}
                                        strokeWidth={item.active ? 2 : 1.75}
                                    />
                                    {item.label}
                                </button>
                            </li>
                        ))}
                    </ul>
                </nav>
                <div className="flex items-center gap-3 border-t border-white/10 px-5 py-4">
                    <UserButton />
                    <div className="min-w-0">
                        {accountName && (
                            <p className="truncate text-sm font-medium text-white">
                                {accountName}
                            </p>
                        )}
                        {accountNote && (
                            <p className="truncate text-xs text-white/55">
                                {accountNote}
                            </p>
                        )}
                    </div>
                </div>
            </aside>

            {/* Phone brand bar */}
            <header className="fixed inset-x-0 top-0 z-40 flex h-14 items-center gap-2.5 bg-ink px-4 text-white lg:hidden">
                <button
                    type="button"
                    onClick={onHome}
                    disabled={disabled}
                    aria-label="Go to home"
                    className="flex items-center gap-2 text-left"
                >
                    <BrandMark size={30} />
                    <span className="font-display text-lg leading-none text-white">
                        OneMD
                    </span>
                </button>
                <div className="ml-auto flex items-center gap-3">
                    {accountNote && (
                        <span className="max-w-[40vw] truncate text-xs text-white/60">
                            {accountNote}
                        </span>
                    )}
                    <UserButton />
                </div>
            </header>

            <main className="px-4 pb-28 pt-[76px] sm:px-6 lg:pb-16 lg:pl-[288px] lg:pr-10 lg:pt-10">
                {children}
            </main>

            {/* Phone tab bar */}
            {nav.length > 1 && !typing && (
                <nav
                    aria-label="Main"
                    className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 backdrop-blur lg:hidden"
                >
                    <ul className="mx-auto flex max-w-md">
                        {nav.map((item) => (
                            <li key={item.key} className="flex-1">
                                <button
                                    type="button"
                                    onClick={item.onClick}
                                    disabled={disabled}
                                    aria-current={
                                        item.active ? "page" : undefined
                                    }
                                    className={`flex w-full flex-col items-center gap-1 px-1 pb-2 pt-2.5 text-[11px] transition-colors disabled:opacity-40 ${
                                        item.active
                                            ? "font-semibold text-clinical-500"
                                            : "text-muted"
                                    }`}
                                >
                                    <span
                                        className={`flex h-7 w-12 items-center justify-center rounded-full transition-colors ${
                                            item.active ? "bg-clinical-50" : ""
                                        }`}
                                    >
                                        <item.icon
                                            size={20}
                                            strokeWidth={item.active ? 2 : 1.75}
                                        />
                                    </span>
                                    {item.label}
                                </button>
                            </li>
                        ))}
                    </ul>
                </nav>
            )}
        </div>
    );
}
