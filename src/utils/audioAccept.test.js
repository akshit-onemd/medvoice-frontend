import { it, expect } from "vitest";
import { AUDIO_ACCEPT } from "./audioAccept";

// iPhone's file picker greys out files that only match "audio/*"
it("lists common recorder formats by extension and type", () => {
    const parts = AUDIO_ACCEPT.split(",");
    for (const p of [".mp3", ".m4a", ".wav", ".aac", ".ogg", ".opus", ".webm", ".amr", "audio/mpeg", "audio/mp4", "audio/x-m4a", "audio/*"]) {
        expect(parts).toContain(p);
    }
});
