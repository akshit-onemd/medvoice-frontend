import { useCallback, useLayoutEffect, useRef } from "react";

// Call focusLast(selector) in the Add handler. After the new row renders,
// the last element matching selector scrolls into view and its first field gets focus.
// Layout effect runs inside the tap, so iPhone opens the keyboard.
export default function useFocusNewRow() {
    const rootRef = useRef(null);
    const target = useRef(null);

    useLayoutEffect(() => {
        const selector = target.current;
        if (!selector) return;
        target.current = null;
        const rows = rootRef.current?.querySelectorAll(selector);
        const last = rows && rows[rows.length - 1];
        if (!last) return;
        const field = last.querySelector(
            "input:not([type=hidden]):not([disabled]), textarea:not([disabled]), select:not([disabled])",
        );
        if (!field) return;
        field.focus({ preventScroll: true });
        field.scrollIntoView({ behavior: "smooth", block: "center" });
    });

    const focusLast = useCallback((selector) => {
        target.current = selector;
    }, []);

    return [rootRef, focusLast];
}
