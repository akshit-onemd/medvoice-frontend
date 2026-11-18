import React from "react";
import { it, expect, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import ShareWhatsAppButton from "./ShareWhatsAppButton";

afterEach(cleanup);
it("asks first, then says it was sent", async () => {
    render(<ShareWhatsAppButton patientName="Ramesh" phone="9876543210" />);
    fireEvent.click(screen.getByLabelText("Share on WhatsApp"));
    expect(screen.getByText(/Send this signed Consultation Summary\/Prescription to Ramesh \+91 9876543210 on WhatsApp/)).toBeTruthy();
    fireEvent.click(screen.getByText("Send"));
    await waitFor(() => expect(screen.getByText("Sent to Ramesh on WhatsApp")).toBeTruthy());
});
