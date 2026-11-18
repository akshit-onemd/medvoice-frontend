import React, { useEffect, useState } from "react";
import { Plus, Pencil, ShieldCheck } from "lucide-react";
import SearchInput from "./SearchInput";
import { listPatients } from "../api/processAudio";
import { peek, setCached } from "../utils/cache";
import ConsentBadge from "./ConsentBadge";

const PAGE = 20;

const fmt = (iso) =>
    new Date(iso).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    });

const initials = (name = "") =>
    name
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((w) => w[0] || "")
        .join("")
        .toUpperCase() || "?";

export function Avatar({ name }) {
    return (
        <span
            aria-hidden="true"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-clinical-50 text-[13px] font-semibold text-clinical-600"
        >
            {initials(name)}
        </span>
    );
}

const visitLine = (p) =>
    p.last_visit
        ? `Last visit ${fmt(p.last_visit)} · ${p.visit_count} visit${p.visit_count === 1 ? "" : "s"}`
        : "No visits yet";

export default function PatientList({
    staff = false,
    hideSearch = false,
    refreshKey = 0,
    onSelect,
    onViewDetails,
    onEdit,
    onConsent,
}) {
    const [query, setQuery] = useState("");
    // The first page (no search) is kept between visits, so the list shows at once and refreshes quietly
    const FIRST = `patients:first:${staff ? "staff" : "doctor"}`;
    const [rows, setRows] = useState(() => peek(FIRST)?.patients || []);
    const [hasMore, setHasMore] = useState(() => !!peek(FIRST)?.hasMore);
    const [loading, setLoading] = useState(() => !peek(FIRST));
    const [loadingMore, setLoadingMore] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        const controller = new AbortController();
        const first = !query.trim();
        const cached = first ? peek(FIRST) : null;
        if (cached) {
            setRows(cached.patients);
            setHasMore(cached.hasMore);
            setLoading(false);
        } else setLoading(true);
        setError("");
        const handle = setTimeout(
            async () => {
                try {
                    const d = await listPatients({
                        q: query.trim(),
                        offset: 0,
                        limit: PAGE,
                        signal: controller.signal,
                    });
                    setRows(d.patients);
                    setHasMore(d.hasMore);
                    if (first) setCached(FIRST, { patients: d.patients, hasMore: d.hasMore });
                } catch (err) {
                    if (err.name === "AbortError") return;
                    setError(err.message || "Failed to load patients");
                    if (!cached) {
                        setRows([]);
                        setHasMore(false);
                    }
                } finally {
                    if (!controller.signal.aborted) setLoading(false);
                }
            },
            query ? 300 : 0,
        );
        return () => {
            clearTimeout(handle);
            controller.abort();
        };
    }, [query, refreshKey]);

    const loadMore = async () => {
        setLoadingMore(true);
        setError("");
        try {
            const d = await listPatients({
                q: query.trim(),
                offset: rows.length,
                limit: PAGE,
            });
            setRows((r) => [
                ...r,
                ...d.patients.filter((p) => !r.some((x) => x.id === p.id)),
            ]);
            setHasMore(d.hasMore);
        } catch (err) {
            setError(err.message || "Failed to load more");
        } finally {
            setLoadingMore(false);
        }
    };

    const meta = (p) =>
        [p.age != null && `${p.age}y`, p.gender, p.phone]
            .filter(Boolean)
            .join(" · ");

    const body = (
        <div>
            {!hideSearch && (
                <SearchInput
                    value={query}
                    onChange={setQuery}
                    placeholder="Search by name or phone"
                    inputClassName="w-full rounded-lg border border-line bg-surface px-3 py-3 text-base text-ink placeholder:text-muted focus:border-clinical-500 outline-none"
                />
            )}

            {loading && (
                <p className="mt-3 text-sm text-muted">Loading patients…</p>
            )}
            {error && <p className="mt-3 text-sm text-alert-500">{error}</p>}

            {!loading && !error && rows.length === 0 && (
                <p className="mt-3 text-sm text-muted">
                    {query.trim()
                        ? `No patient found for “${query.trim()}”.`
                        : "No patients yet."}
                </p>
            )}

            {!loading && rows.length > 0 && (
                <>
                    {/* {!staff && (
                        <p className="mt-3 text-xs text-muted">
                            Tap a row or click “View details” for records
                        </p>
                    )} */}
                    <ul className="mt-3 divide-y divide-line">
                        {rows.map((p) =>
                            staff ? (
                                <li
                                    key={p.id}
                                    className="flex items-center gap-2"
                                >
                                    <button
                                        type="button"
                                        onClick={() => onEdit?.(p)}
                                        className="min-w-0 flex-1 flex items-center gap-3 rounded px-2 py-3 text-left hover:bg-paper"
                                    >
                                        <Avatar name={p.name} />
                                        <div className="min-w-0 flex-1">
                                            <p className="flex items-center gap-2 text-[15px] font-medium text-ink">
                                                <span className="truncate">
                                                    {p.name}
                                                </span>
                                                <ConsentBadge
                                                    status={
                                                        p.consent_status ||
                                                        "none"
                                                    }
                                                />
                                            </p>
                                            <p className="text-xs text-muted">
                                                {meta(p)}
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
                                    {onConsent &&
                                        (p.consent_status || "none") !==
                                            "valid" && (
                                            <button
                                                type="button"
                                                onClick={() => onConsent(p)}
                                                className="shrink-0 inline-flex items-center gap-1 rounded bg-clinical-500 px-3 py-2 text-xs font-medium text-paper hover:bg-clinical-600"
                                            >
                                                <ShieldCheck size={14} />
                                                {p.consent_status === "outdated"
                                                    ? "Re-sign"
                                                    : "Consent"}
                                            </button>
                                        )}
                                </li>
                            ) : (
                                <li
                                    key={p.id}
                                    className="flex items-center gap-2"
                                >
                                    <button
                                        type="button"
                                        onClick={() => onViewDetails?.(p)}
                                        className="min-w-0 flex-1 flex items-center gap-3 rounded text-left px-2 py-3 hover:bg-paper"
                                    >
                                        <Avatar name={p.name} />
                                        <span className="min-w-0 flex-1 block">
                                        <p className="flex items-center gap-2 text-[15px] font-medium text-ink">
                                            <span className="truncate">
                                                {p.name}
                                            </span>
                                            <ConsentBadge
                                                status={
                                                    p.consent_status || "none"
                                                }
                                            />
                                        </p>
                                        <p className="text-xs text-muted">
                                            {meta(p)}
                                        </p>
                                        <p className="text-xs text-muted mt-0.5">
                                            {visitLine(p)}
                                        </p>
                                        </span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => onSelect?.(p)}
                                        className="shrink-0 inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-clinical-200 bg-clinical-50 px-3 py-1.5 sm:px-3.5 sm:py-2 text-[13px] font-medium text-clinical-600 hover:border-clinical-500 hover:bg-clinical-500 hover:text-white transition-colors"
                                    >
                                        <Plus size={14} strokeWidth={2} />
                                        New visit
                                    </button>
                                </li>
                            ),
                        )}
                    </ul>
                    {hasMore && (
                        <button
                            type="button"
                            onClick={loadMore}
                            disabled={loadingMore}
                            className="mt-3 w-full rounded border border-line bg-surface py-2.5 text-sm text-ink hover:bg-paper disabled:opacity-40"
                        >
                            {loadingMore ? "Loading…" : "Load more"}
                        </button>
                    )}
                </>
            )}
        </div>
    );

    if (staff) return body;

    return (
        <div className="w-full max-w-3xl mx-auto">
            <h1 className="page-title mb-5">Patients</h1>
            <div className="bg-surface border border-line rounded-md shadow-panel p-4 sm:p-5">
                {body}
            </div>
        </div>
    );
}
