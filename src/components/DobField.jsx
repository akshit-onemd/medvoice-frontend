import React, {
    forwardRef,
    memo,
    useCallback,
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import { createPortal } from "react-dom";
import { CalendarDays } from "lucide-react";
import { ageLabel } from "../utils/patientValidation";

const ITEM_H = 40;
const VISIBLE = 5; // rows shown. Middle row is the selection.
const MONTHS = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
];

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const pad = (n) => String(n).padStart(2, "0");
const daysIn = (y, m) => new Date(y, m, 0).getDate(); // m is 1 to 12

const parse = (iso) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || "");
    return m ? { y: +m[1], m: +m[2], d: +m[3] } : null;
};
const show = ({ y, m, d }) => `${pad(d)} ${MONTHS[m - 1]} ${y}`;
const Item = memo(function Item({ text, selected, index, onPick }) {
    return (
        <div
            role="option"
            aria-selected={selected}
            onClick={() => onPick(index)}
            className="flex cursor-pointer select-none items-center justify-center overflow-hidden text-base"
            style={{ height: ITEM_H, scrollSnapAlign: "center" }}
        >
            <span
                className={`inline-block transition-transform duration-100 ${
                    selected ? "scale-110 font-medium text-ink" : "text-muted"
                }`}
            >
                {text}
            </span>
        </div>
    );
});
function Wheel({ items, index, onChange, label }) {
    const ref = useRef(null);
    const timer = useRef(null);
    const raf = useRef(0);
    const scrolling = useRef(false);
    const latest = useRef({});
    latest.current = { index, onChange, len: items.length };
    const [live, setLive] = useState(index); // row under the highlight right now

    // Follow outside changes: opening, or a short month clamping the day.
    // Never touch the position while a finger is moving the wheel.
    useLayoutEffect(() => {
        setLive(index);
        const el = ref.current;
        if (!el || scrolling.current) return;
        const target = index * ITEM_H;
        if (Math.abs(el.scrollTop - target) > 1) el.scrollTop = target;
    }, [index, items.length]);

    // Scroll finished: save the row under the highlight
    const commit = () => {
        clearTimeout(timer.current);
        scrolling.current = false;
        const el = ref.current;
        if (!el) return;
        const { index: cur, onChange: change, len } = latest.current;
        const i = clamp(Math.round(el.scrollTop / ITEM_H), 0, len - 1);
        if (i !== cur) change(i);
    };

    const onScroll = () => {
        scrolling.current = true;
        if (!raf.current) {
            raf.current = requestAnimationFrame(() => {
                raf.current = 0;
                const el = ref.current;
                if (!el) return;
                const i = clamp(
                    Math.round(el.scrollTop / ITEM_H),
                    0,
                    latest.current.len - 1,
                );
                setLive((p) => (p === i ? p : i));
            });
        }
        clearTimeout(timer.current);
        timer.current = setTimeout(commit, 140); // fallback where scrollend is missing
    };

    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        el.addEventListener("scrollend", commit);
        return () => {
            el.removeEventListener("scrollend", commit);
            clearTimeout(timer.current);
            cancelAnimationFrame(raf.current);
        };
    }, []);

    const pick = useCallback((i) => {
        ref.current?.scrollTo({ top: i * ITEM_H, behavior: "smooth" });
    }, []);

    const onKeyDown = (e) => {
        if (e.key === "ArrowDown") {
            e.preventDefault();
            onChange(clamp(index + 1, 0, items.length - 1));
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            onChange(clamp(index - 1, 0, items.length - 1));
        }
    };

    return (
        <div
            ref={ref}
            role="listbox"
            aria-label={label}
            tabIndex={0}
            onScroll={onScroll}
            onKeyDown={onKeyDown}
            className="dob-wheel relative z-10 min-w-0 flex-1 overflow-x-hidden overflow-y-auto outline-none focus-visible:ring-1 focus-visible:ring-clinical-500"
            style={{
                height: ITEM_H * VISIBLE,
                paddingTop: ITEM_H * 2,
                paddingBottom: ITEM_H * 2,
                scrollSnapType: "y mandatory",
                overscrollBehavior: "contain",
                touchAction: "pan-y",
                scrollbarWidth: "none",
                WebkitOverflowScrolling: "touch",
            }}
        >
            {items.map((t, i) => (
                <Item
                    key={t}
                    text={t}
                    index={i}
                    selected={i === live}
                    onPick={pick}
                />
            ))}
        </div>
    );
}

function DobSheet({ value, onConfirm, onClear, onCancel }) {
    const today = useMemo(() => {
        const n = new Date();
        return { cy: n.getFullYear(), cm: n.getMonth() + 1, cd: n.getDate() };
    }, []);
    const { cy, cm, cd } = today;
    const panelRef = useRef(null);

    // Nobody is born in the future or more than 120 years ago
    const normalize = (s) => {
        const y = clamp(s.y, cy - 120, cy);
        const m = clamp(s.m, 1, y === cy ? cm : 12);
        const d = clamp(s.d, 1, y === cy && m === cm ? cd : daysIn(y, m));
        return { y, m, d };
    };

    const [sel, setSel] = useState(() => {
        const p = parse(value);
        return normalize(p || { y: cy, m: cm, d: cd });
    });

    const years = useMemo(
        () => Array.from({ length: 121 }, (_, i) => String(cy - 120 + i)),
        [cy],
    );
    const monthCount = sel.y === cy ? cm : 12;
    const dayCount = sel.y === cy && sel.m === cm ? cd : daysIn(sel.y, sel.m);
    const months = MONTHS.slice(0, monthCount);
    const days = Array.from({ length: dayCount }, (_, i) => String(i + 1));

    useEffect(() => {
        const prev = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        panelRef.current?.focus();
        return () => {
            document.body.style.overflow = prev;
        };
    }, []);

    useEffect(() => {
        const onKey = (e) => {
            if (e.key === "Escape") onCancel();
        };
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [onCancel]);

    const iso = `${sel.y}-${pad(sel.m)}-${pad(sel.d)}`;

    return createPortal(
        <div
            className="fixed inset-0 z-[100] flex items-end justify-center overflow-hidden overscroll-contain bg-ink/50 sm:items-center sm:p-4"
            onMouseDown={(e) => {
                if (e.target === e.currentTarget) onCancel();
            }}
        >
            <style>{".dob-wheel::-webkit-scrollbar{display:none}"}</style>
            <div
                ref={panelRef}
                tabIndex={-1}
                role="dialog"
                aria-modal="true"
                aria-labelledby="dob-title"
                className="w-full overflow-x-hidden rounded-t-lg border border-line bg-surface p-5 shadow-panel outline-none sm:max-w-sm sm:rounded-md"
                style={{
                    paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))",
                    overscrollBehavior: "contain",
                }}
            >
                <h2 id="dob-title" className="font-serif text-lg text-ink">
                    Date of birth
                </h2>
                <p className="mt-1 text-sm text-clinical-600">
                    {show(sel)} · {ageLabel(iso)}
                </p>

                <div className="relative mt-4 flex gap-2 overflow-hidden">
                    {" "}
                    <div
                        className="pointer-events-none absolute inset-x-0 z-0 rounded border-y border-line bg-clinical-50"
                        style={{ top: ITEM_H * 2, height: ITEM_H }}
                    />
                    <div className="pointer-events-none absolute inset-x-0 top-0 z-20 h-16 bg-gradient-to-b from-surface to-transparent" />
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-16 bg-gradient-to-t from-surface to-transparent" />
                    <Wheel
                        label="Day"
                        items={days}
                        index={sel.d - 1}
                        onChange={(i) =>
                            setSel(normalize({ ...sel, d: i + 1 }))
                        }
                    />
                    <Wheel
                        label="Month"
                        items={months}
                        index={sel.m - 1}
                        onChange={(i) =>
                            setSel(normalize({ ...sel, m: i + 1 }))
                        }
                    />
                    <Wheel
                        label="Year"
                        items={years}
                        index={sel.y - (cy - 120)}
                        onChange={(i) =>
                            setSel(normalize({ ...sel, y: cy - 120 + i }))
                        }
                    />
                </div>

                <div className="mt-5 flex items-center gap-3">
                    {value && (
                        <button
                            type="button"
                            onClick={onClear}
                            className="text-sm text-alert-500 underline underline-offset-2"
                        >
                            Clear
                        </button>
                    )}
                    <div className="ml-auto flex gap-3">
                        <button
                            type="button"
                            onClick={onCancel}
                            className="rounded border border-line bg-surface px-5 py-2.5 text-sm text-ink hover:bg-paper"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={() => onConfirm(iso)}
                            className="rounded bg-clinical-500 px-5 py-2.5 text-sm font-medium text-paper hover:bg-clinical-600"
                        >
                            Confirm
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body,
    );
}

const DobField = forwardRef(function DobField(
    { value, onChange, hasError = false, disabled = false },
    ref,
) {
    const [open, setOpen] = useState(false);
    const p = parse(value);

    return (
        <>
            <button
                ref={ref}
                type="button"
                id="pf-dob"
                onClick={() => setOpen(true)}
                disabled={disabled}
                aria-haspopup="dialog"
                aria-invalid={hasError}
                className={`flex w-full items-center justify-between rounded border bg-paper px-3 py-2 text-left text-sm outline-none focus:border-clinical-500 disabled:opacity-50 ${
                    hasError ? "border-alert-500" : "border-line"
                }`}
            >
                <span className={p ? "text-ink" : "text-muted"}>
                    {p ? show(p) : "Select date of birth"}
                </span>
                <CalendarDays
                    size={16}
                    strokeWidth={1.75}
                    className="text-muted"
                />
            </button>

            {open && (
                <DobSheet
                    value={value}
                    onConfirm={(iso) => {
                        onChange(iso);
                        setOpen(false);
                    }}
                    onClear={() => {
                        onChange("");
                        setOpen(false);
                    }}
                    onCancel={() => setOpen(false)}
                />
            )}
        </>
    );
});

export default DobField;
