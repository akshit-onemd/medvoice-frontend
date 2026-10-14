import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./index.css";
import { ClerkProvider } from "@clerk/react";
import { API_BASE_URL } from "./api/processAudio";

if (import.meta.env.PROD) {
    fetch(`${API_BASE_URL}/health`, { mode: "no-cors" }).catch(() => {});
}
ReactDOM.createRoot(document.getElementById("root")).render(
    <ClerkProvider publishableKey={import.meta.env.VITE_CLERK_PUBLISHABLE_KEY}>
        <App />
    </ClerkProvider>,
);
