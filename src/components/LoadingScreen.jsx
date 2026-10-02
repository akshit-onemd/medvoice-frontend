import React, { useEffect, useState } from "react";

export default function LoadingScreen({
    messages,
    slowMessage = "Taking longer than usual…",
    slowAfter = 9000, // ms before the slow message appears
    interval = 2200, // ms between normal messages
}) {
    const [text, setText] = useState(messages[0]);
    const [visible, setVisible] = useState(true);

    useEffect(() => {
        const timers = [];
        const show = (next) => {
            setVisible(false); // fade out
            timers.push(
                setTimeout(() => {
                    setText(next);
                    setVisible(true); // fade in
                }, 300),
            );
        };

        // Schedule the normal messages, skipping any that would land after the slow message
        messages.slice(1).forEach((m, i) => {
            const at = (i + 1) * interval;
            if (at < slowAfter) timers.push(setTimeout(() => show(m), at));
        });

        // Slow message fires at a fixed time, independent of the list length
        timers.push(setTimeout(() => show(slowMessage), slowAfter));

        return () => timers.forEach(clearTimeout);
    }, [messages, slowMessage, slowAfter, interval]);

    return (
        <div className="min-h-screen bg-paper flex flex-col items-center justify-center gap-4">
            <div
                className="h-6 w-6 rounded-full border-2 border-clinical-500 border-t-transparent motion-safe:animate-spin"
                aria-hidden="true"
            />
            <p
                role="status"
                aria-live="polite"
                className={`text-sm text-muted transition-opacity duration-300 ${
                    visible ? "opacity-100" : "opacity-0"
                }`}
            >
                {text}
            </p>
        </div>
    );
}
