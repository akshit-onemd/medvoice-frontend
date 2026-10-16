import { useEffect, useRef, useState } from "react";
import {
    loadRecord,
    saveItem,
    removeItem,
    removeByPrefix,
    clearHomeDrafts,
    fileToRecord,
    recordToFile,
    recoverRecording,
} from "../utils/draftStore";
import { decodePeaks } from "../utils/audioPeaks";

const newId = () =>
    crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const mmss = (s) =>
    `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;

export default function useHomeDraft({
    skip,
    selectedPatient,
    newPatientSeed,
    file,
    fileLabel,
    filePeaks,
    fileDuration,
    attachments,
    setters,
}) {
    const [ready, setReady] = useState(false);
    const [note, setNote] = useState(null);
    const ids = useRef(new WeakMap());
    const savedAtt = useRef(new Set());
    const savedFile = useRef(null);
    const latestSetters = useRef(setters);
    latestSetters.current = setters;

    const idFor = (f) => {
        if (!ids.current.has(f)) ids.current.set(f, newId());
        return ids.current.get(f);
    };

    // ---- restore once ----
    useEffect(() => {
        if (skip) {
            setReady(true);
            return;
        }
        let cancelled = false;
        (async () => {
            const s = latestSetters.current;
            let text = "";
            try {
                const metaRec = await loadRecord("home:meta");
                const meta = metaRec?.data;
                if (meta?.patient) s.setSelectedPatient(meta.patient);
                if (meta?.seed) s.setNewPatientSeed(meta.seed);
                if (meta) text = "Restored your unsaved work.";

                const audioRec = await loadRecord("home:audio");
                if (audioRec) {
                    const f = recordToFile(audioRec.data);
                    savedFile.current = f;
                    s.setFile(f);
                    s.setFileLabel(meta?.fileLabel || "consultation-audio");
                    s.setFilePeaks(meta?.filePeaks || null);
                    s.setFileDuration(meta?.fileDuration || 0);
                    text = "Restored your unsaved work.";
                    removeByPrefix("rec:");
                } else {
                    const rec = await recoverRecording();
                    if (rec) {
                        s.setFile(rec.file);
                        s.setFileLabel("consultation-audio");
                        s.setFilePeaks(null);
                        s.setFileDuration(rec.seconds);
                        decodePeaks(rec.file).then((p) =>
                            latestSetters.current.setFilePeaks(p),
                        );
                        text = `Recovered ${mmss(rec.seconds)} of audio from a recording a reload cut off. Check it before you generate.`;
                    }
                }

                const restoredAtt = [];
                for (const a of meta?.attachments || []) {
                    const rec = await loadRecord(`home:att:${a.id}`);
                    if (!rec) continue;
                    const f = recordToFile(rec.data);
                    ids.current.set(f, a.id);
                    savedAtt.current.add(a.id);
                    restoredAtt.push(f);
                }
                if (restoredAtt.length) {
                    s.setAttachments(restoredAtt);
                    text = text || "Restored your unsaved work.";
                }
            } catch {
                /* storage unavailable: start clean */
            }
            if (!cancelled) {
                setReady(true);
                if (text) setNote({ text });
            }
        })();
        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ---- save: patient, form seed, labels, attachment list ----
    useEffect(() => {
        if (!ready) return;
        const write = () => {
            const nothing =
                !selectedPatient &&
                !newPatientSeed &&
                !file &&
                attachments.length === 0;
            if (nothing) {
                removeByPrefix("home:");
                return;
            }
            saveItem("home:meta", {
                patient: selectedPatient || null,
                seed: newPatientSeed || null,
                fileLabel,
                filePeaks,
                fileDuration,
                attachments: attachments.map((f) => ({
                    id: idFor(f),
                    name: f.name,
                    type: f.type,
                })),
            });
        };
        let timer = setTimeout(() => {
            timer = null;
            write();
        }, 300);
        const flush = () => {
            if (!timer) return;
            clearTimeout(timer);
            timer = null;
            write();
        };
        const onHide = () => {
            if (document.visibilityState === "hidden") flush();
        };
        document.addEventListener("visibilitychange", onHide);
        window.addEventListener("pagehide", flush);
        return () => {
            if (timer) clearTimeout(timer);
            document.removeEventListener("visibilitychange", onHide);
            window.removeEventListener("pagehide", flush);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        ready,
        selectedPatient,
        newPatientSeed,
        file,
        fileLabel,
        filePeaks,
        fileDuration,
        attachments,
    ]);

    // ---- save: the audio file ----
    useEffect(() => {
        if (!ready) return;
        if (!file) {
            if (savedFile.current) {
                savedFile.current = null;
                removeItem("home:audio");
            }
            return;
        }
        if (savedFile.current === file) return;
        savedFile.current = file;
        (async () => {
            try {
                await saveItem("home:audio", await fileToRecord(file));
                await removeByPrefix("rec:"); // the finished file replaces the chunks
            } catch {
                /* storage full: keep the chunks */
            }
        })();
    }, [ready, file]);

    // ---- save: attachments ----
    useEffect(() => {
        if (!ready) return;
        const current = new Set();
        attachments.forEach((f) => {
            const id = idFor(f);
            current.add(id);
            if (!savedAtt.current.has(id)) {
                savedAtt.current.add(id);
                fileToRecord(f)
                    .then((r) => saveItem(`home:att:${id}`, r))
                    .catch(() => {});
            }
        });
        [...savedAtt.current].forEach((id) => {
            if (!current.has(id)) {
                savedAtt.current.delete(id);
                removeItem(`home:att:${id}`);
            }
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ready, attachments]);

    const discardAll = async () => {
        await clearHomeDrafts();
        const s = latestSetters.current;
        savedFile.current = null;
        savedAtt.current = new Set();
        s.setSelectedPatient(null);
        s.setNewPatientSeed(null);
        s.setFile(null);
        s.setFileLabel("");
        s.setFilePeaks(null);
        s.setFileDuration(0);
        s.setAttachments([]);
        setNote(null);
    };

    return { note, dismissNote: () => setNote(null), discardAll };
}
