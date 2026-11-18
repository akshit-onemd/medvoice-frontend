import React, { useEffect, useRef, useState } from "react";
import ConfirmDialog from "../components/ConfirmDialog";

const MARK = { appBackGuard: true };

// Events that count as a real user tap/press. Browsers (Chrome and Safari)
// skip history entries that were added without one, which is how Back used
// to slip straight out of the app. pointerdown/touchstart don't count on
// touch screens, so they're not here.
const GESTURES = ["click", "touchend", "pointerup", "keydown"];

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
 * active        keep a guard entry in history (true for the whole session)
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

    const armedRef = useRef(false);
    const leavingRef = useRef(false);
    const [prompt, setPrompt] = useState(null);

    const arm = () => {
        if (armedRef.current || leavingRef.current || !activeRef.current)
            return;
        window.history.pushState(MARK, "", window.location.href);
        armedRef.current = true;
    };

    const leave = () => {
        // Step over our guard entry too, if it's there
        const steps = armedRef.current ? 2 : 1;
        armedRef.current = false;
        leavingRef.current = true;
        window.history.go(-steps);
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

    // Arm on load too. Some browsers ignore an entry added before the first
    // tap; the gesture listeners below cover those once the person taps.
    useEffect(() => {
        if (active) arm();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [active]);

    useEffect(() => {
        const onGesture = () => arm();
        GESTURES.forEach((ev) =>
            window.addEventListener(ev, onGesture, {
                passive: true,
                capture: true,
            }),
        );

        const onPop = () => {
            if (!armedRef.current) return; // not our entry
            armedRef.current = false;
            const top = layers[layers.length - 1];
            let result = "stay";
            try {
                result = (top ? top.ref.current() : backRef.current?.()) || "stay";
            } catch {
                result = "stay";
            }
            if (result !== "leave") arm(); // protect again right away
            settle(result);
        };

        const onBeforeUnload = (e) => {
            if (!warnRef.current || leavingRef.current) return;
            e.preventDefault();
            e.returnValue = "";
        };
        const onPageShow = (e) => {
            if (e.persisted) leavingRef.current = false;
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
