import React, { useEffect, useRef, useState } from "react";
import ConfirmDialog from "../components/ConfirmDialog";

// Each guard entry we add carries its depth: 1, 2, ... above the page's own entry.
const KEY = "appBackGuard";
const depthOf = (state) =>
    state && typeof state[KEY] === "number" ? state[KEY] : 0;
// Spare guard entries kept ready, so two quick Backs are both caught.
const SPARE = 2;

// Only add entries during a real tap or key press. Chrome and Safari skip
// history entries added without one (on page load, inside a Back handler,
// after a scroll), and Back then jumps straight out of the app.
const GESTURES = ["click", "keydown"];

// Overlays (camera scanner, full-screen pickers, dialogs) that Back should
// close first. Last one opened wins.
const layers = [];

/**
 * Let an open overlay handle Back before the page does.
 * handler returns "stay" (handled), "leave", or a prompt object (see below).
 */
export function useBackLayer(active, handler) {
    const ref = useRef(handler);
    ref.current = handler;
    useEffect(() => {
        if (!active) return undefined;
        const layer = { ref };
        layers.push(layer);
        return () => {
            const i = layers.indexOf(layer);
            if (i >= 0) layers.splice(i, 1);
        };
    }, [active]);
}

/**
 * Keeps the person inside the app: Back runs onBack instead of leaving.
 *
 * active        guard Back (true for the whole session)
 * warnOnUnload  browser prompt on refresh/close while work is at risk
 * onBack        returns "stay" | "leave" | prompt, where prompt is
 *               { title, message, confirmLabel, cancelLabel, destructive,
 *                 onConfirm: () => "stay" | "leave" }
 *
 * Returns an element to render: the in-app confirm shown on Back.
 */
export default function useBackNav({ active, warnOnUnload, onBack }) {
    const activeRef = useRef(active);
    const warnRef = useRef(warnOnUnload);
    const backRef = useRef(onBack);
    activeRef.current = active;
    warnRef.current = warnOnUnload;
    backRef.current = onBack;

    const leavingRef = useRef(false);
    const [prompt, setPrompt] = useState(null);
    // After a refresh we may already be sitting on a guard entry left by the
    // previous page load. Entries below it belong to that old page, so count
    // spares from here.
    const baseRef = useRef(depthOf(window.history.state));
    const depthRef = useRef(baseRef.current);

    const topUp = () => {
        if (leavingRef.current || !activeRef.current) return;
        let d = depthOf(window.history.state);
        const want = baseRef.current + SPARE;
        while (d < want) {
            d += 1;
            window.history.pushState({ [KEY]: d }, "", window.location.href);
        }
        depthRef.current = d;
    };

    const leave = () => {
        // Past every guard entry and the page's own entry
        const d = depthOf(window.history.state);
        leavingRef.current = true;
        window.history.go(-(d + 1));
        // Nothing earlier in history (opened in a fresh tab): still here.
        setTimeout(() => {
            if (document.visibilityState !== "visible") return;
            leavingRef.current = false;
        }, 1200);
    };

    const settle = (result) => {
        if (result === "leave") leave();
        else if (result && typeof result === "object") setPrompt(result);
    };

    useEffect(() => {
        const onGesture = () => topUp();
        GESTURES.forEach((ev) =>
            window.addEventListener(ev, onGesture, {
                passive: true,
                capture: true,
            }),
        );

        const onPop = (e) => {
            const d = depthOf(e.state);
            const wentBack = d < depthRef.current;
            depthRef.current = d;
            if (!wentBack || leavingRef.current || !activeRef.current) return;
            // Nothing is added to history here; the next tap tops up again.
            const top = layers[layers.length - 1];
            let result = "stay";
            try {
                result =
                    (top ? top.ref.current() : backRef.current?.()) || "stay";
            } catch {
                result = "stay";
            }
            settle(result);
        };

        const onBeforeUnload = (e) => {
            if (!warnRef.current || leavingRef.current) return;
            e.preventDefault();
            e.returnValue = "";
        };
        const onPageShow = (e) => {
            if (!e.persisted) return;
            leavingRef.current = false;
            depthRef.current = depthOf(window.history.state);
        };

        window.addEventListener("popstate", onPop);
        window.addEventListener("beforeunload", onBeforeUnload);
        window.addEventListener("pageshow", onPageShow);
        return () => {
            GESTURES.forEach((ev) =>
                window.removeEventListener(ev, onGesture, { capture: true }),
            );
            window.removeEventListener("popstate", onPop);
            window.removeEventListener("beforeunload", onBeforeUnload);
            window.removeEventListener("pageshow", onPageShow);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Block pull-to-refresh while work is at risk
    useEffect(() => {
        if (!warnOnUnload) return undefined;
        const html = document.documentElement;
        const body = document.body;
        const prevH = html.style.overscrollBehaviorY;
        const prevB = body.style.overscrollBehaviorY;
        html.style.overscrollBehaviorY = "contain";
        body.style.overscrollBehaviorY = "contain";
        return () => {
            html.style.overscrollBehaviorY = prevH;
            body.style.overscrollBehaviorY = prevB;
        };
    }, [warnOnUnload]);

    if (!prompt) return null;
    return React.createElement(ConfirmDialog, {
        title: prompt.title,
        message: prompt.message,
        confirmLabel: prompt.confirmLabel || "Leave",
        cancelLabel: prompt.cancelLabel || "Stay",
        destructive: prompt.destructive,
        onCancel: () => setPrompt(null),
        onConfirm: () => {
            setPrompt(null);
            let result = "stay";
            try {
                result = prompt.onConfirm?.() || "stay";
            } catch {
                result = "stay";
            }
            settle(result);
        },
    });
}
