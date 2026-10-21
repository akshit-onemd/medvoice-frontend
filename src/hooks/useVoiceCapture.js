import { useCallback, useEffect, useRef, useState } from "react";

// Tap to start, tap to stop. Hands back one audio clip.
export default function useVoiceCapture({ onClip, maxSeconds = 120 }) {
    const [recording, setRecording] = useState(false);
    const [seconds, setSeconds] = useState(0);
    const [stream, setStream] = useState(null);
    const [error, setError] = useState("");

    const recRef = useRef(null);
    const streamRef = useRef(null);
    const chunksRef = useRef([]);
    const timerRef = useRef(null);
    const startedRef = useRef(0);
    const discardRef = useRef(false);
    const onClipRef = useRef(onClip);
    onClipRef.current = onClip;

    const release = useCallback(() => {
        clearInterval(timerRef.current);
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        setStream(null);
        setRecording(false);
    }, []);

    const stop = useCallback(() => {
        const rec = recRef.current;
        if (rec && rec.state !== "inactive") rec.stop(); // onstop does the rest
    }, []);

    const cancel = useCallback(() => {
        discardRef.current = true;
        const rec = recRef.current;
        if (rec && rec.state !== "inactive") rec.stop();
        else release();
    }, [release]);

    const start = useCallback(async () => {
        setError("");
        if (
            !navigator.mediaDevices?.getUserMedia ||
            typeof MediaRecorder === "undefined"
        ) {
            setError("Voice input isn't supported in this browser.");
            return;
        }
        try {
            const s = await navigator.mediaDevices.getUserMedia({
                audio: true,
            });
            streamRef.current = s;
            const mimeType = ["audio/mp4", "audio/webm", ""].find(
                (t) => t === "" || MediaRecorder.isTypeSupported(t),
            );
            const rec = mimeType
                ? new MediaRecorder(s, { mimeType })
                : new MediaRecorder(s);
            recRef.current = rec;
            chunksRef.current = [];
            discardRef.current = false;

            rec.ondataavailable = (e) => {
                if (e.data.size > 0) chunksRef.current.push(e.data);
            };
            rec.onstop = () => {
                const discard = discardRef.current;
                const secs = (Date.now() - startedRef.current) / 1000;
                const blob = new Blob(chunksRef.current, {
                    type: rec.mimeType || "audio/webm",
                });
                release();
                recRef.current = null;
                if (discard) return;
                if (secs < 1 || blob.size < 1500) {
                    setError(
                        "That was too short. Tap the mic, speak, then tap stop.",
                    );
                    return;
                }
                onClipRef.current(blob);
            };

            rec.start(1000);
            startedRef.current = Date.now();
            setSeconds(0);
            setStream(s);
            setRecording(true);
            timerRef.current = setInterval(() => {
                const secs = Math.floor(
                    (Date.now() - startedRef.current) / 1000,
                );
                setSeconds(secs);
                if (secs >= maxSeconds) stop();
            }, 500);
        } catch (err) {
            release();
            setError(
                err?.name === "NotAllowedError"
                    ? "Microphone permission was denied. Allow it in your browser settings."
                    : err?.name === "NotFoundError"
                      ? "No microphone was found on this device."
                      : "Couldn't start the microphone.",
            );
        }
    }, [maxSeconds, release, stop]);

    useEffect(
        () => () => {
            discardRef.current = true;
            const rec = recRef.current;
            if (rec && rec.state !== "inactive") rec.stop();
            else {
                clearInterval(timerRef.current);
                streamRef.current?.getTracks().forEach((t) => t.stop());
            }
        },
        [],
    );

    return { recording, seconds, stream, error, start, stop, cancel };
}
