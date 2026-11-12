import { useEffect, useSyncExternalStore } from "react";
import { getMe, saveDoctorSettings } from "../api/processAudio";

// The doctor's "Show medical codes" setting, shared by every screen.
// It is read once from the account and kept here. Codes are on until it says otherwise.
let showCodes = true;
let loading = null;
const listeners = new Set();
const emit = () => listeners.forEach((l) => l());
const subscribe = (cb) => {
    listeners.add(cb);
    return () => listeners.delete(cb);
};

function load() {
    if (!loading)
        loading = getMe()
            .then((me) => {
                const v = me?.profile?.show_codes;
                if (typeof v === "boolean" && v !== showCodes) {
                    showCodes = v;
                    emit();
                }
            })
            .catch(() => {
                loading = null; // try again next time a screen asks
            });
    return loading;
}

export function useShowCodes() {
    useEffect(() => {
        load();
    }, []);
    return useSyncExternalStore(subscribe, () => showCodes);
}

// Changes it at once on screen, then saves. Goes back if saving fails.
export async function setShowCodes(v) {
    const prev = showCodes;
    showCodes = v;
    emit();
    try {
        await saveDoctorSettings({ show_codes: v });
    } catch (err) {
        showCodes = prev;
        emit();
        throw err;
    }
}
