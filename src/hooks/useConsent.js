import { useEffect, useState } from "react";
import { getConsent } from "../api/consent";

// Current consent status for one patient:
// null (loading / no patient) | "valid" | "none" | "outdated" | "declined" | "withdrawn"
// Returns [status, setStatus]; call setStatus after a consent is recorded.
export default function useConsent(patientId) {
    const [status, setStatus] = useState(null);
    useEffect(() => {
        if (!patientId) {
            setStatus(null);
            return;
        }
        let cancelled = false;
        setStatus(null);
        getConsent(patientId)
            .then((r) => !cancelled && setStatus(r.status))
            .catch(() => !cancelled && setStatus("none")); // fail closed
        return () => {
            cancelled = true;
        };
    }, [patientId]);
    return [status, setStatus];
}
