import React, { useEffect, useState } from "react";
import { Plus, Pencil } from "lucide-react";
import SearchInput from "./SearchInput";
import { listPatients } from "../api/processAudio";

const PAGE = 20;

const fmt = (iso) =>
    new Date(iso).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    });

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
}) {
    const [query, setQuery] = useState("");
    const [rows, setRows] = useState([]);
    const [hasMore, setHasMore] = useState(false);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        const controller = new AbortController();
        setLoading(true);
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
                } catch (err) {
                    if (err.name === "AbortError") return;
                    setError(err.message || "Failed to load patients");
                    setRows([]);
                    setHasMore(false);
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
                    placeholder="Search patients by name or phone"
                    inputClassName="w-full rounded border border-line bg-paper px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-clinical-500 outline-none"
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
                    <ul className="mt-1 rounded border border-line divide-y divide-line overflow-hidden">
                        {rows.map((p) =>
                            staff ? (
                                <li key={p.id}>
                                    <button
                                        type="button"
                                        onClick={() => onEdit?.(p)}
                                        className="w-full flex items-center gap-3 px-3 py-3 text-left hover:bg-paper"
                                    >
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm text-ink truncate">
                                                {p.name}
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
                                </li>
                            ) : (
                                <li
                                    key={p.id}
                                    className="flex items-center gap-2 pr-2"
                                >
                                    <button
                                        type="button"
                                        onClick={() => onViewDetails?.(p)}
                                        className="min-w-0 flex-1 text-left px-3 py-3 hover:bg-paper"
                                    >
                                        <p className="text-sm text-ink truncate">
                                            {p.name}
                                        </p>
                                        <p className="text-xs text-muted">
                                            {meta(p)}
                                        </p>
                                        <p className="text-xs text-muted mt-0.5">
                                            {visitLine(p)}
                                        </p>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => onSelect?.(p)}
                                        className="shrink-0 inline-flex items-center gap-1 rounded border border-clinical-500 bg-clinical-50 px-3 py-2 text-xs font-medium text-clinical-600 hover:bg-clinical-500 hover:text-paper transition-colors"
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
        <div className="w-full max-w-2xl mx-auto">
            <div className="bg-surface border border-line rounded-md shadow-panel p-4">
                <h2 className="font-serif text-xl text-ink mb-3">Patients</h2>
                {body}
            </div>
        </div>
    );
}
