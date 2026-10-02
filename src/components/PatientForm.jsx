import React, { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import {
    TITLES,
    MARITAL,
    BLOOD_GROUPS,
    YES_NO,
    GENDERS,
    HISTORY,
    HABITS,
    ageLabel,
    todayISO,
    minDobISO,
    formFrom,
    toPayload,
    validatePatient,
    validateField,
    hasExtras,
    EXTRA_ERROR_KEYS,
    FIELD_ORDER,
} from "../utils/patientValidation";

const inputCls =
    "w-full rounded border border-line bg-paper px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-clinical-500 outline-none disabled:opacity-50";

const errorField = (msg) =>
    /uhid/i.test(msg) ? "uhid" : /phone/i.test(msg) ? "phone" : null;

function Field({ label, required, error, children }) {
    return (
        <label className="block">
            <span className="block text-xs text-muted mb-1">
                {label}
                {required && <span className="text-alert-500"> *</span>}
            </span>
            {children}
            {error && (
                <span className="block text-xs text-alert-500 mt-1">
                    {error}
                </span>
            )}
        </label>
    );
}

function Section({ title, children }) {
    return (
        <div className="mt-5">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted mb-2">
                {title}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {children}
            </div>
        </div>
    );
}

function Select({ value, onChange, options, placeholder, disabled }) {
    return (
        <select
            className={inputCls}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
        >
            <option value="">{placeholder}</option>
            {options.map((o) =>
                Array.isArray(o) ? (
                    <option key={o[0]} value={o[0]}>
                        {o[1]}
                    </option>
                ) : (
                    <option key={o} value={o}>
                        {o}
                    </option>
                ),
            )}
        </select>
    );
}

export default function PatientForm({
    initial,
    submitLabel = "Save patient",
    cancelLabel = "Cancel",
    saving = false,
    error = "",
    onSubmit,
    onCancel,
}) {
    const [f, setF] = useState(() => formFrom(initial));
    const [errors, setErrors] = useState({});
    const [open, setOpen] = useState(() => hasExtras(formFrom(initial)));
    const [focus, setFocus] = useState(null); // { key, n }
    const touched = useRef({});
    const refs = useRef({});
    const errBoxRef = useRef(null);

    // Scroll to and focus a field after render (extras may just have opened)
    useEffect(() => {
        if (!focus) return;
        const el = refs.current[focus.key];
        if (el) {
            el.scrollIntoView({ behavior: "smooth", block: "center" });
            el.focus({ preventScroll: true });
        }
    }, [focus]);

    // Server error: pin to field when known, else scroll to message
    useEffect(() => {
        if (!error) return;
        const k = errorField(error);
        if (k) {
            setErrors((e) => ({ ...e, [k]: error }));
            if (EXTRA_ERROR_KEYS.includes(k)) setOpen(true);
            setFocus({ key: k, n: Date.now() });
        } else {
            errBoxRef.current?.scrollIntoView({
                behavior: "smooth",
                block: "center",
            });
        }
    }, [error]);

    const check = (k, nextF, final) => {
        const msg = validateField(k, toPayload(nextF)[k], final);
        setErrors((e) => {
            const n = { ...e };
            if (msg) n[k] = msg;
            else delete n[k];
            return n;
        });
    };

    const set = (k, v) => {
        const next = { ...f, [k]: v };
        setF(next);
        if (FIELD_ORDER.includes(k)) check(k, next, !!touched.current[k]);
    };

    const blur = (k) => {
        touched.current[k] = true;
        check(k, f, true);
    };

    const inp = (k, props = {}) => (
        <input
            id={`pf-${k}`}
            ref={(el) => {
                refs.current[k] = el;
            }}
            className={`${inputCls} ${errors[k] ? "border-alert-500" : ""}`}
            value={f[k]}
            onChange={(e) => set(k, e.target.value)}
            onBlur={() => blur(k)}
            aria-invalid={!!errors[k]}
            autoComplete="off"
            {...props}
        />
    );

    const age = ageLabel(f.dob);
    const legacyAge =
        !f.dob && initial?.age ? `${initial.age} yrs (on record)` : "";

    const submit = () => {
        const payload = toPayload(f);
        const errs = validatePatient(payload);
        FIELD_ORDER.forEach((k) => (touched.current[k] = true));
        setErrors(errs);
        const first = FIELD_ORDER.find((k) => errs[k]);
        if (first) {
            if (EXTRA_ERROR_KEYS.includes(first)) setOpen(true);
            setFocus({ key: first, n: Date.now() });
            return;
        }
        onSubmit(payload);
    };

    return (
        <div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Full name" required error={errors.name}>
                    {inp("name", { placeholder: "Full name" })}
                </Field>
                <Field label="Phone number" required error={errors.phone}>
                    {inp("phone", {
                        type: "tel",
                        inputMode: "tel",
                        placeholder: "10-digit mobile number",
                        maxLength: 10,
                    })}
                </Field>
                <Field label="Date of birth" error={errors.dob}>
                    {inp("dob", {
                        type: "date",
                        max: todayISO(),
                        min: minDobISO(),
                    })}
                </Field>
                <Field label="Age (auto)">
                    <input
                        className={`${inputCls} bg-surface text-muted`}
                        value={age || legacyAge}
                        placeholder="From date of birth"
                        readOnly
                        tabIndex={-1}
                    />
                </Field>
                <Field label="Gender">
                    <Select
                        value={f.gender}
                        onChange={(v) => set("gender", v)}
                        options={GENDERS}
                        placeholder="Gender"
                    />
                </Field>
            </div>

            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className="mt-4 inline-flex items-center gap-1.5 text-sm text-clinical-600 hover:underline"
            >
                {open ? "Hide additional fields" : "Add additional fields"}
                <ChevronDown
                    size={14}
                    className={`transition-transform ${open ? "rotate-180" : ""}`}
                />
            </button>

            {open && (
                <div>
                    <Section title="Identification">
                        <Field label="Title">
                            <Select
                                value={f.title}
                                onChange={(v) => set("title", v)}
                                options={TITLES}
                                placeholder="Select"
                            />
                        </Field>
                        <Field label="UHID" error={errors.uhid}>
                            {inp("uhid")}
                        </Field>
                    </Section>

                    <Section title="Demographics">
                        <Field label="Marital status">
                            <Select
                                value={f.marital_status}
                                onChange={(v) => set("marital_status", v)}
                                options={MARITAL}
                                placeholder="Select"
                            />
                        </Field>
                        <Field label="Occupation">{inp("occupation")}</Field>
                    </Section>

                    <Section title="Contact">
                        <Field
                            label="Alternative phone"
                            error={errors.alt_phone}
                        >
                            {inp("alt_phone", {
                                type: "tel",
                                inputMode: "tel",
                                maxLength: 10,
                            })}
                        </Field>
                        <Field label="Email" error={errors.email}>
                            {inp("email", { type: "email" })}
                        </Field>
                    </Section>

                    <Section title="Address">
                        <div className="sm:col-span-2">
                            <Field label="Address">{inp("address")}</Field>
                        </div>
                        <Field label="City">{inp("city")}</Field>
                        <Field label="Pincode" error={errors.pincode}>
                            {inp("pincode", {
                                inputMode: "numeric",
                                maxLength: 6,
                            })}
                        </Field>
                    </Section>

                    <Section title="Other details">
                        <Field label="Name of informant">
                            {inp("informant_name")}
                        </Field>
                        <Field label="Channel">{inp("channel")}</Field>
                        <Field label="Tag">{inp("tag")}</Field>
                    </Section>

                    <Section title="Referral">
                        <Field label="Referred by">
                            {inp("referred_by_name")}
                        </Field>
                        <Field
                            label="Referrer contact"
                            error={errors.referred_by_phone}
                        >
                            {inp("referred_by_phone", {
                                type: "tel",
                                inputMode: "tel",
                                maxLength: 10,
                            })}
                        </Field>
                    </Section>

                    <Section title="Medical">
                        <Field label="Blood group">
                            <Select
                                value={f.blood_group}
                                onChange={(v) => set("blood_group", v)}
                                options={BLOOD_GROUPS}
                                placeholder="Select"
                            />
                        </Field>
                        <div className="sm:col-span-2">
                            <label className="inline-flex items-center gap-2 text-sm text-ink">
                                <input
                                    type="checkbox"
                                    checked={f.no_known_history}
                                    onChange={(e) => {
                                        const on = e.target.checked;
                                        setF((s) => ({
                                            ...s,
                                            no_known_history: on,
                                            ...(on
                                                ? {
                                                      diabetes: "",
                                                      hypertension: "",
                                                      hypothyroidism: "",
                                                  }
                                                : {}),
                                        }));
                                    }}
                                />
                                No known medical history
                            </label>
                        </div>
                        {HISTORY.map(([k, label]) => (
                            <Field key={k} label={label}>
                                <Select
                                    value={f[k]}
                                    onChange={(v) => set(k, v)}
                                    options={YES_NO}
                                    placeholder="Not set"
                                    disabled={f.no_known_history}
                                />
                            </Field>
                        ))}
                        {HABITS.map(([k, label]) => (
                            <Field key={k} label={label}>
                                <Select
                                    value={f[k]}
                                    onChange={(v) => set(k, v)}
                                    options={YES_NO}
                                    placeholder="Not set"
                                />
                            </Field>
                        ))}
                    </Section>
                </div>
            )}

            {error && !errorField(error) && (
                <p ref={errBoxRef} className="mt-4 text-sm text-alert-500">
                    {error}
                </p>
            )}

            <div className="mt-5 flex gap-3">
                <button
                    type="button"
                    onClick={onCancel}
                    disabled={saving}
                    className="rounded border border-line bg-surface px-5 py-2.5 text-sm text-ink hover:bg-paper disabled:opacity-40"
                >
                    {cancelLabel}
                </button>
                <button
                    type="button"
                    onClick={submit}
                    disabled={saving}
                    className="flex-1 rounded bg-clinical-500 px-5 py-2.5 text-sm font-medium text-paper hover:bg-clinical-600 disabled:opacity-40 transition-colors"
                >
                    {saving ? "Saving…" : submitLabel}
                </button>
            </div>
        </div>
    );
}
