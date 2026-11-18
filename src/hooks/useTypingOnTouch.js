import { useEffect, useState } from "react";

// Inputs that never bring up the on-screen keyboard.
const NO_KEYBOARD = new Set(["button", "checkbox", "radio", "range", "color", "file", "submit", "reset", "image", "hidden"]);

const isTextEntry = (el) =>
    !!el &&
    ((el.tagName === "INPUT" && !NO_KEYBOARD.has((el.type || "text").toLowerCase())) ||
        el.tagName === "TEXTAREA" ||
        el.isContentEditable);

/**
 * True while the on-screen keyboard is (very likely) open on a phone/tablet,
 * so fixed bottom UI can step out of its way. Always false with a mouse.
 *
 * Signals:
 *  - focus moving into a text field                    -> typing
 *  - a completed tap (click) on the field that is
 *    already focused, e.g. one autofocused on load     -> typing
 *  - focus leaving text fields                         -> not typing
 *  - the visual viewport growing back (keyboard shut)  -> not typing
 *  - any scroll while no text field has focus          -> not typing (safety net)
 *
 * A bare pointerdown is deliberately NOT a signal: on touch screens it also
 * fires when a finger lands on a field only to scroll the page, and no focus
 * change follows to undo it.
 */
export default function useTypingOnTouch() {
    const [typing, setTyping] = useState(false);

    useEffect(() => {
        const touch = window.matchMedia?.("(pointer: coarse)").matches;
        if (!touch) return undefined;

        const vv = window.visualViewport;
        let fullHeight = vv ? vv.height : window.innerHeight;
        let shrank = false;

        const onIn = (e) => {
            if (isTextEntry(e.target)) setTyping(true);
        };
        // click only fires for a real tap, never for the start of a scroll.
        const onTap = (e) => {
            const el = document.activeElement;
            if (isTextEntry(el) && (el === e.target || el.contains(e.target))) setTyping(true);
        };
        const onOut = () =>
            setTimeout(() => {
                if (!isTextEntry(document.activeElement)) {
                    shrank = false;
                    setTyping(false);
                }
            }, 0);
        const onScroll = () => {
            if (!isTextEntry(document.activeElement)) setTyping(false);
        };
        const onResize = () => {
            const h = vv.height;
            if (h > fullHeight) fullHeight = h;
            if (h < fullHeight - 120) shrank = true;
            else if (shrank) {
                shrank = false;
                setTyping(false);
            }
        };

        document.addEventListener("focusin", onIn);
        document.addEventListener("focusout", onOut);
        document.addEventListener("click", onTap, true);
        window.addEventListener("scroll", onScroll, { capture: true, passive: true });
        vv?.addEventListener("resize", onResize);
        return () => {
            document.removeEventListener("focusin", onIn);
            document.removeEventListener("focusout", onOut);
            document.removeEventListener("click", onTap, true);
            window.removeEventListener("scroll", onScroll, { capture: true });
            vv?.removeEventListener("resize", onResize);
        };
    }, []);

    return typing;
}
