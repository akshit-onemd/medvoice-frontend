import { useEffect, useRef } from "react";

const MARK = { appBackGuard: true };

// active: keep a history entry so Back reaches onBack instead of leaving
// warnOnUnload: show the browser's refresh and close prompt
// onBack: returns "stay" (handled inside the app) or "leave" (exit the app)
export default function useBackNav({ active, warnOnUnload, onBack }) {
    const activeRef = useRef(active);
    const warnRef = useRef(warnOnUnload);
    const backRef = useRef(onBack);
    activeRef.current = active;
    warnRef.current = warnOnUnload;
    backRef.current = onBack;

    const armedRef = useRef(false);
    const leavingRef = useRef(false);

    const arm = () => {
        if (armedRef.current) return;
        window.history.pushState(MARK, "", window.location.href);
        armedRef.current = true;
    };

    // Add the entry when the guard is first needed
    useEffect(() => {
        if (!active) return;
        leavingRef.current = false;
        arm();
    }, [active]);

    useEffect(() => {
        // Chrome skips entries added before the first tap. Arm on a tap as well.
        const onGesture = () => {
            if (activeRef.current && !leavingRef.current) arm();
        };
        const events = ["pointerdown", "touchstart", "keydown"];
        events.forEach((ev) =>
            window.addEventListener(ev, onGesture, {
                passive: true,
                capture: true,
            }),
        );

        const onPop = () => {
            if (!armedRef.current) return; // not our entry
            armedRef.current = false;
            let result = "stay";
            try {
                result = backRef.current?.() || "stay";
            } catch {
                result = "stay";
            }
            if (result === "leave") {
                leavingRef.current = true;
                window.history.back();
                // If nothing earlier exists, we are still here. Protect again.
                setTimeout(() => {
                    if (document.visibilityState !== "visible") return;
                    leavingRef.current = false;
                    if (activeRef.current) arm();
                }, 1200);
            } else {
                arm();
            }
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
            events.forEach((ev) =>
                window.removeEventListener(ev, onGesture, { capture: true }),
            );
            window.removeEventListener("popstate", onPop);
            window.removeEventListener("beforeunload", onBeforeUnload);
            window.removeEventListener("pageshow", onPageShow);
        };
    }, []);

    // Block pull-to-refresh while work is at risk
    useEffect(() => {
        if (!warnOnUnload) return;
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
}
