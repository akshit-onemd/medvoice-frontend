// Display only: "Paracetamol 500 mg" becomes "Paracetamol 500 mg (Dolo 650)". Stored data stays generic.
export const withBrandNames = (rx) =>
    rx && Array.isArray(rx.medications)
        ? {
              ...rx,
              medications: rx.medications.map((m) =>
                  m?.brand ? { ...m, name: `${m.name} (${m.brand})` } : m,
              ),
          }
        : rx;
