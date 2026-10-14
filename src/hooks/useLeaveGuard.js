import { useEffect, useRef } from "react";

export default function useLeaveGuard(
    active,
    message = "You have unsaved work. Leave anyway?",
) {
    const activeRef = useRef(active);
    activeRef.current = active;
    const sentinel = useRef(false);
    const leaving = useRef(false);

    // Refresh and tab close. Desktop browsers only.
    useEffect(() => {
        const onBeforeUnload = (e) => {
            if (!activeRef.current || leaving.current) return;
            e.preventDefault();
            e.returnValue = "";
        };
        window.addEventListener("beforeunload", onBeforeUnload);
        return () => window.removeEventListener("beforeunload", onBeforeUnload);
    }, []);

    // Block pull-to-refresh while work sits at risk
    useEffect(() => {
        if (!active) return;
        const el = document.documentElement;
        const prev = el.style.overscrollBehaviorY;
        el.style.overscrollBehaviorY = "contain";
        return () => {
            el.style.overscrollBehaviorY = prev;
        };
    }, [active]);

    // Push one sentinel entry when guard first turns on. Never pop it by code.
    useEffect(() => {
        if (active && !sentinel.current) {
            window.history.pushState(
                { leaveGuard: true },
                "",
                window.location.href,
            );
            sentinel.current = true;
        }
    }, [active]);

    useEffect(() => {
        const onPopState = () => {
            if (!sentinel.current) return; // our own back() call
            sentinel.current = false;
            if (!activeRef.current || window.confirm(message)) {
                leaving.current = true;
                window.history.back();
                setTimeout(() => (leaving.current = false), 1000);
            } else {
                window.history.pushState(
                    { leaveGuard: true },
                    "",
                    window.location.href,
                );
                sentinel.current = true;
            }
        };
        window.addEventListener("popstate", onPopState);
        return () => window.removeEventListener("popstate", onPopState);
    }, [message]);
}
