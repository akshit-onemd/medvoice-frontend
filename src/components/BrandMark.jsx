import React from "react";

export default function BrandMark({ size = 40 }) {
    return (
        <img
            src="/onemd-icon.png"
            alt="OneMD Scribe"
            style={{ width: size, height: size }}
            className="rounded object-contain"
        />
    );
}
