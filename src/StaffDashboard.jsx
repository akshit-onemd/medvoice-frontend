import React, { useEffect, useState } from "react";
import { UserPlus, Pencil } from "lucide-react";
import { UserButton } from "@clerk/react";
import SearchInput from "./components/SearchInput";
import {
    searchPatients,
    createPatient,
    updatePatient,
} from "./api/processAudio";
import BrandMark from "./components/BrandMark";

const inputCls =
    "w-full rounded border border-line bg-paper px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-clinical-500 outline-none";
const blank = { name: "", phone: "", age: "", gender: "" };

const asPhone = (q) => {
    const d = q.replace(/[\s\-+()]/g, "");
    return /^\d{4,}$/.test(d) ? d : null;
};

export default function StaffDashboard({ doctorName }) {
    const [mode, setMode] = useState(null); // null | "add" | "edit"
    const [form, setForm] = useState(blank);
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

    const set = (patch) => setForm((f) => ({ ...f, ...patch }));

    const startAdd = (q) => {
        const phone = asPhone(q);
        setForm({ ...blank, name: phone ? "" : q, phone: phone || "" });
        setEditingId(null);
        setMode("add");
        setError("");
        setNotice("");
        setQuery("");
    };

    const startEdit = (p) => {
        setForm({
            name: p.name || "",
            phone: p.phone || "",
            age: p.age ?? "",
            gender: p.gender || "",
        });
        setEditingId(p.id);
        setMode("edit");
        setError("");
        setNotice("");
        setQuery("");
    };

    const closeForm = () => {
        setMode(null);
        setEditingId(null);
        setForm(blank);
        setError("");
    };

    const handleSave = async () => {
        setError("");
        if (!form.name.trim()) return setError("Name is required.");
        if (!form.phone.trim()) return setError("Phone number is required.");
        setSaving(true);
        try {
            const payload = {
                name: form.name,
                phone: form.phone,
                age: form.age,
                gender: form.gender,
            };
            const name = form.name.trim();
            if (mode === "edit") {
                await updatePatient(editingId, payload);
                setNotice(`Updated ${name}.`);
            } else {
                await createPatient(payload);
                setNotice(
                    `Added ${name}. ${drName} can find them by searching.`,
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
    const showAddPrompt =
        q.length >= 2 &&
        !searching &&
        searchedFor === q &&
        results.length === 0;

    return (
        <div className="min-h-screen bg-paper px-4 py-8">
            <div className="w-full max-w-2xl mx-auto">
                <div className="flex items-center gap-3 mb-6">
                    <BrandMark />
                    <h1 className="font-serif text-2xl text-ink leading-tight">
                        OneMD
                    </h1>
                    <span className="rounded-full border border-line bg-surface px-2 py-0.5 text-xs text-muted">
                        Staff
                    </span>
                    <div className="ml-auto">
                        <UserButton />
                    </div>
                </div>

                {mode ? (
                    <div className="bg-surface border border-line rounded-md shadow-panel p-6">
                        <div className="flex items-center gap-2 mb-1">
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
                        </p>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <input
                                className={inputCls}
                                placeholder="Full name"
                                value={form.name}
                                onChange={(e) => set({ name: e.target.value })}
                            />
                            <input
                                className={inputCls}
                                type="tel"
                                placeholder="Phone number"
                                value={form.phone}
                                onChange={(e) => set({ phone: e.target.value })}
                            />
                            <input
                                className={inputCls}
                                type="number"
                                placeholder="Age"
                                value={form.age}
                                onChange={(e) => set({ age: e.target.value })}
                            />
                            <select
                                className={inputCls}
                                value={form.gender}
                                onChange={(e) =>
                                    set({ gender: e.target.value })
                                }
                            >
                                <option value="">Gender</option>
                                <option value="male">Male</option>
                                <option value="female">Female</option>
                                <option value="other">Other</option>
                            </select>
                        </div>

                        {error && (
                            <p className="mt-3 text-sm text-alert-500">
                                {error}
                            </p>
                        )}

                        <div className="mt-4 flex gap-3">
                            <button
                                type="button"
                                onClick={closeForm}
                                disabled={saving}
                                className="rounded border border-line bg-surface px-5 py-2.5 text-sm text-ink hover:bg-paper disabled:opacity-40"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleSave}
                                disabled={saving}
                                className="flex-1 rounded bg-clinical-500 py-2.5 text-sm font-medium text-paper hover:bg-clinical-600 disabled:opacity-40 transition-colors"
                            >
                                {saving
                                    ? "Saving…"
                                    : mode === "edit"
                                      ? "Save changes"
                                      : "Add patient"}
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="bg-surface border border-line rounded-md shadow-panel p-6">
                        <SearchInput
                            value={query}
                            onChange={setQuery}
                            placeholder="Search patient by name or phone"
                            autoFocus
                            inputClassName={inputCls}
                        />
                        {notice && (
                            <p className="mt-3 text-sm text-clinical-600">
                                {notice}
                            </p>
                        )}
                        {searching && (
                            <p className="mt-2 text-xs text-muted">
                                Searching…
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
                                                        p.age && `${p.age}y`,
                                                        p.gender,
                                                        p.phone,
                                                    ]
                                                        .filter(Boolean)
                                                        .join(" · ")}
                                                </p>
                                            </div>
                                            <span className="inline-flex items-center gap-1 text-xs text-clinical-600">
                                                <Pencil
                                                    size={12}
                                                    strokeWidth={1.75}
                                                />
                                                Edit
                                            </span>
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}

                        {showAddPrompt && (
                            <div className="mt-3 rounded border border-line bg-paper px-4 py-3">
                                {/* <p className="text-sm text-ink">
                                    No patient found for “{q}”.
                                </p> */}
                                <button
                                    type="button"
                                    onClick={() => startAdd(q)}
                                    className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-clinical-600 hover:underline"
                                >
                                    <UserPlus size={14} strokeWidth={1.75} />
                                    {asPhone(q)
                                        ? `Add a new patient with phone ${asPhone(q)}`
                                        : `Add “${q}” as a new patient`}
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
