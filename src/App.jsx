import React, { useEffect, useState } from "react";
import { Show, SignIn, UserButton, useAuth } from "@clerk/react";
import Dashboard from "./Dashboard";
import ProfileForm from "./components/ProfileForm";
import BrandMark from "./components/BrandMark";
import {
    getDoctorProfile,
    getMe,
    setAuthTokenGetter,
} from "./api/processAudio";
import StaffDashboard from "./StaffDashboard";
function ProfileGate() {
    const { getToken } = useAuth();
    setAuthTokenGetter(getToken); // set during render so it's ready before any child request

    const [profile, setProfile] = useState(undefined); // undefined = loading, null = not set up yet
    const [loadError, setLoadError] = useState("");
    const [attempt, setAttempt] = useState(0);

    useEffect(() => {
        let cancelled = false;
        setLoadError("");
        getDoctorProfile({ force: true })
            .then((p) => !cancelled && setProfile(p))
            .catch(
                (err) =>
                    !cancelled &&
                    setLoadError(err.message || "Couldn't load your profile."),
            );
        return () => {
            cancelled = true;
        };
    }, [attempt]);

    if (loadError) {
        return (
            <div className="min-h-screen bg-paper flex flex-col items-center justify-center gap-3 px-4">
                <p className="text-sm text-alert-500">{loadError}</p>
                <button
                    type="button"
                    onClick={() => setAttempt((n) => n + 1)}
                    className="rounded bg-clinical-500 text-paper px-4 py-2 text-sm"
                >
                    Try again
                </button>
            </div>
        );
    }

    if (profile === undefined) {
        return (
            <div className="min-h-screen bg-paper flex items-center justify-center">
                <p className="text-sm text-muted">Loading…</p>
            </div>
        );
    }

    if (profile === null) {
        return (
            <div className="min-h-screen bg-paper px-4 py-10">
                <div className="w-full max-w-2xl mx-auto mb-6 flex items-center gap-3">
                    {/* <div className="flex h-10 w-10 items-center justify-center rounded bg-clinical-500 text-paper">
                        <Stethoscope size={20} strokeWidth={1.75} />
                    </div> */}
                    <BrandMark />
                    <h1 className="font-serif text-3xl text-ink leading-tight">
                        OneMD
                    </h1>
                    <div className="ml-auto">
                        <UserButton />
                    </div>
                </div>
                <ProfileForm
                    title="Set up your doctor profile"
                    intro="Your name and signature appear on the consultation PDFs you download."
                    initial={null}
                    onSaved={setProfile}
                />
            </div>
        );
    }

    return <Dashboard profile={profile} onProfileChange={setProfile} />;
}
function RoleGate() {
    const { getToken } = useAuth();
    setAuthTokenGetter(getToken); // set during render so it's ready before the first request

    const [me, setMe] = useState(undefined); // undefined = loading
    const [loadError, setLoadError] = useState("");
    const [attempt, setAttempt] = useState(0);

    useEffect(() => {
        let cancelled = false;
        setLoadError("");
        getMe()
            .then((m) => !cancelled && setMe(m))
            .catch(
                (err) =>
                    !cancelled &&
                    setLoadError(err.message || "Couldn't load your account."),
            );
        return () => {
            cancelled = true;
        };
    }, [attempt]);

    if (loadError) {
        return (
            <div className="min-h-screen bg-paper flex flex-col items-center justify-center gap-3 px-4">
                <p className="text-sm text-alert-500">{loadError}</p>
                <button
                    type="button"
                    onClick={() => setAttempt((n) => n + 1)}
                    className="rounded bg-clinical-500 text-paper px-4 py-2 text-sm"
                >
                    Try again
                </button>
            </div>
        );
    }
    if (me === undefined) {
        return (
            <div className="min-h-screen bg-paper flex items-center justify-center">
                <p className="text-sm text-muted">Loading…</p>
            </div>
        );
    }
    if (me.role === "staff")
        return <StaffDashboard doctorName={me.doctor_name} />;
    return <ProfileGate />;
}
export default function App() {
    return (
        <>
            <Show when="signed-out">
                <div className="min-h-screen bg-paper flex items-center justify-center px-4">
                    <SignIn />
                </div>
            </Show>
            <Show when="signed-in">
                <RoleGate />
            </Show>
        </>
    );
}
