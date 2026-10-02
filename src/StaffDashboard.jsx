import React, { useEffect, useState } from "react";
import { UserPlus, Pencil } from "lucide-react";
import { UserButton } from "@clerk/react";
import SearchInput from "./components/SearchInput";
import PatientForm from "./components/PatientForm";
import {
    searchPatients,
    createPatient,
    updatePatient,
} from "./api/processAudio";
import BrandMark from "./components/BrandMark";

const inputCls =
    "w-full rounded border border-line bg-paper px-3 py-2 text-xl text-ink placeholder:text-muted focus:border-clinical-500 outline-none";

const asPhone = (q) => {
    const d = q.replace(/[\s\-+()]/g, "");
    return /^\d{4,}$/.test(d) ? d : null;
};

export default function StaffDashboard({ doctorName }) {
    const [mode, setMode] = useState(null); // null | "add" | "edit"
    const [initial, setInitial] = useState(null);
    const [editingId, setEditingId] = useState(null);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");
    const [query, setQuery] = useState("");
    const [results, setResults] = useState([]);
    const [searching, setSearching] = useState(false);
    const [searchedFor, setSearchedFor] = useState("");

    const drName = doctorName
        ? /^dr\b/i.test(doctorName)
            ? doctorName
            : `Dr. ${doctorName}`
        : "The doctor";

    useEffect(() => {
        const q = query.trim();
        if (q.length < 2) {
            setResults([]);
            setSearching(false);
            setSearchedFor("");
            return;
        }
        setSearching(true);
        const controller = new AbortController();
        const handle = setTimeout(async () => {
            try {
                setResults(await searchPatients(q, controller.signal));
                setSearchedFor(q);
            } catch (err) {
                if (err.name === "AbortError") return;
                setResults([]);
                setSearchedFor("");
            } finally {
                if (!controller.signal.aborted) setSearching(false);
            }
        }, 300);
        return () => {
            clearTimeout(handle);
            controller.abort();
        };
    }, [query]);

    const startAdd = (q) => {
        const phone = asPhone(q);
        setInitial({ name: phone ? "" : q, phone: phone || "" });
        setEditingId(null);
        setMode("add");
        setError("");
        setNotice("");
        setQuery("");
    };

    const startEdit = (p) => {
        setInitial(p);
        setEditingId(p.id);
        setMode("edit");
        setError("");
        setNotice("");
        setQuery("");
    };

    const closeForm = () => {
        setMode(null);
        setInitial(null);
        setEditingId(null);
        setError("");
    };

    const handleSave = async (payload) => {
        setError("");
        setSaving(true);
        try {
            if (mode === "edit") {
                await updatePatient(editingId, payload);
                setNotice(`Updated ${payload.name}.`);
            } else {
                await createPatient(payload);
                setNotice(
                    `Added ${payload.name}. ${drName} can find them by searching.`,
                );
            }
            closeForm();
        } catch (err) {
            setError(err.message || "Couldn't save the patient.");
        } finally {
            setSaving(false);
        }
    };

    const q = query.trim();
const showAddPrompt = q.length >= 2 && !searching && searchedFor === q;
    return (
        <div className="min-h-screen bg-paper px-4 pt-24 pb-16">
            <div className="fixed top-0 left-0 right-0 z-50 bg-paper border-b border-line">
                <div className="w-full max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
                    <button
                        type="button"
                        aria-label="Go to home"
                        className="flex items-center gap-3 text-left disabled:cursor-not-allowed"
                    >
                        <BrandMark />
                        <h1 className="font-serif text-3xl text-ink leading-tight">
                            OneMD
                        </h1>
                    </button>
                    <div className="ml-auto flex items-center gap-3">
                        <span className="rounded-full border border-line bg-surface px-2 py-0.5 text-sm text-muted">
                            Staff
                        </span>

                        <UserButton />
                    </div>
                </div>
            </div>

            {mode ? (
                <div className="w-full max-w-2xl mx-auto">
                    <div className="bg-surface border border-line rounded-md shadow-panel p-6">
                        {/* <div className="flex items-center gap-2 mb-1">
                            <UserPlus
                                size={16}
                                className="text-clinical-600"
                                strokeWidth={1.75}
                            />
                            <h2 className="font-serif text-lg text-ink">
                                {mode === "edit"
                                    ? "Edit patient"
                                    : "Add a patient"}
                            </h2>
                        </div>
                        <p className="text-sm text-muted mb-4">
                            Patients you add are ready for {drName} to search
                            and start.
                        </p> */}
                        <PatientForm
                            key={editingId || "new"}
                            initial={initial}
                            submitLabel={
                                mode === "edit" ? "Save changes" : "Add patient"
                            }
                            saving={saving}
                            error={error}
                            onSubmit={handleSave}
                            onCancel={closeForm}
                        />
                    </div>
                </div>
            ) : (
                <div className="w-full max-w-2xl mx-auto">
                    <div className="bg-surface border border-line rounded-md shadow-panel p-6">
                        <SearchInput
                            value={query}
                            onChange={setQuery}
                            placeholder="Search Patient by name or phone"
                            autoFocus
                            searching={searching}
                            inputClassName={inputCls}
                        />
                        {notice && (
                            <p className="mt-3 text-sm text-clinical-600">
                                {notice}
                            </p>
                        )}

                        {results.length > 0 && (
                            <ul className="mt-3 rounded border border-line divide-y divide-line overflow-hidden">
                                {results.map((p) => (
                                    <li key={p.id}>
                                        <button
                                            type="button"
                                            onClick={() => startEdit(p)}
                                            className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-paper"
                                        >
                                            <div className="min-w-0 flex-1">
                                                <p className="text-sm text-ink truncate">
                                                    {p.name}
                                                </p>
                                                <p className="text-xs text-muted">
                                                    {[
                                                        p.age != null &&
                                                            `${p.age}y`,
                                                        p.gender,
                                                        p.phone,
                                                    ]
                                                        .filter(Boolean)
                                                        .join(" · ")}
                                                </p>
                                            </div>
                                            <span className="shrink-0 inline-flex items-center gap-1 rounded border border-clinical-500 bg-clinical-500 px-3 py-2 text-sm font-medium text-clinical-50 hover:bg-clinical-500 hover:text-paper transition-colors">
                                                Edit
                                            </span>
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}

                        {showAddPrompt && (
                            <button
                                type="button"
                                onClick={() => startAdd(q)}
                                className="mt-3 w-full rounded border border-clinical-500 bg-paper px-4 py-3 text-left hover:bg-clinical-50 transition-colors"
                            >
                                <span className="mt-1 inline-flex items-center gap-1.5 text-md font-medium text-clinical-600">
                                    {asPhone(q)
                                        ? `Add a new patient with phone ${asPhone(q)}`
                                        : `Add “${q}” as a new patient`}
                                </span>
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
