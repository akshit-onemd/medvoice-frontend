import React, { useEffect, useState } from "react";
import { setDraftUser, purgeExpired } from "./utils/draftStore";
import { Show, SignIn, UserButton, useAuth } from "@clerk/react";
import Dashboard from "./Dashboard";
import ProfileForm from "./components/ProfileForm";
import BrandMark from "./components/BrandMark";
import {
    getDoctorProfile,
    getMe,
    primeDoctorProfile,
    setAuthTokenGetter,
} from "./api/processAudio";
import StaffDashboard from "./StaffDashboard";
import LoadingScreen from "./components/LoadingScreen";

const ACCOUNT_MESSAGES = [
    "Signing you in securely…",
    "Checking your account…",
    "Preparing your workspace…",
    "Almost there…",
];

const PROFILE_MESSAGES = [
    "Loading your profile…",
    "Fetching your details and signature…",
    "Setting up your environment…",
    "Almost there…",
];
function ProfileGate({ initialProfile }) {
    const [profile, setProfile] = useState(initialProfile); // null = not set up yet

    if (profile === null) {
        return (
            <div className="min-h-screen bg-paper px-4 py-10">
                <div className="w-full max-w-2xl mx-auto mb-6 flex items-center gap-3">
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
    const { getToken, userId } = useAuth();
    setAuthTokenGetter(getToken); // set during render so it's ready before the first request
    setDraftUser(userId);
    useEffect(() => {
        purgeExpired();
    }, []);
    const [me, setMe] = useState(undefined); // undefined = loading
    const [loadError, setLoadError] = useState("");
    const [attempt, setAttempt] = useState(0);

    useEffect(() => {
        let cancelled = false;
        setLoadError("");
        getMe()
            .then(async (m) => {
                if (cancelled) return;
                if (m.role === "doctor") {
                    let profile = m.profile;
                    if (profile === undefined) {
                        // old backend: key missing. Fetch directly.
                        profile = await getDoctorProfile({ force: true });
                    }
                    if (cancelled) return;
                    primeDoctorProfile(profile ?? null);
                    setMe({ ...m, profile: profile ?? null });
                    return;
                }
                setMe(m);
            })
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
            <LoadingScreen
                messages={PROFILE_MESSAGES}
                slowMessage="Server waking up. First load can take up to a minute."
            />
        );
    }
    if (me.role === "staff")
        return <StaffDashboard doctorName={me.doctor_name} />;
    return <ProfileGate initialProfile={me.profile ?? null} />;
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
