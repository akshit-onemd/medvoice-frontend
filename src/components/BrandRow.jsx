import React from "react";
import { Star } from "lucide-react";

export default function BrandRow({
    info,
    selected,
    onSelect,
    onStar,
    disabled,
}) {
    if (!info?.brands?.length) return null;
    return (
        <div className="flex flex-wrap items-center gap-1.5 pb-2.5 pl-9 pr-3">
            <span className="text-[11px] uppercase tracking-wide text-muted">
                Brands
            </span>
            {info.brands.map((b) => {
                const on = selected === b.name;
                return (
                    <span
                        key={b.name}
                        className={`inline-flex items-center overflow-hidden rounded-full border text-xs ${
                            on
                                ? "border-clinical-500 bg-clinical-50 text-clinical-600"
                                : "border-line bg-paper text-ink"
                        }`}
                    >
                        <button
                            type="button"
                            disabled={disabled}
                            onClick={() => onSelect(on ? "" : b.name)}
                            title={b.manufacturer || ""}
                            className="px-2.5 py-1 disabled:opacity-50"
                        >
                            {b.name}
                        </button>
                        <button
                            type="button"
                            disabled={disabled}
                            onClick={() => onStar(b)}
                            aria-label={
                                b.favourite
                                    ? `Remove ${b.name} from favourites`
                                    : `Favourite ${b.name}`
                            }
                            className="border-l border-line px-1.5 py-1 hover:bg-white/60 disabled:opacity-50"
                        >
                            <Star
                                size={12}
                                strokeWidth={1.75}
                                className={
                                    b.favourite
                                        ? "fill-amber-400 text-amber-500"
                                        : "text-muted"
                                }
                            />
                        </button>
                    </span>
                );
            })}
        </div>
    );
}
