"use client";
import { useSyncExternalStore } from "react";

function subscribe(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

export default function OfflineBadge() {
  // useSyncExternalStore reads navigator.onLine synchronously on the client,
  // so the badge is correct from the very first render — no useEffect flash.
  // The server snapshot is `true` (assume online) to avoid hydration mismatches.
  const isOnline = useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );

  if (isOnline) return null;

  return (
    <div className="fixed top-2 left-1/2 -translate-x-1/2 z-50 bg-amber-100 text-amber-800 text-xs font-medium px-3 py-1 rounded-full shadow-md pointer-events-none select-none">
      Offline
    </div>
  );
}
