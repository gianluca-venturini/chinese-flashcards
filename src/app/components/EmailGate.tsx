"use client";

import { usePathname } from "next/navigation";

/**
 * Hides the page from users whose email is not on the allow list. The Stack
 * handler pages stay visible so the user can still sign out. The API rejects
 * these users too; this only stops them from seeing an empty, broken app.
 */
export default function EmailGate({
  authorized,
  children,
}: {
  authorized: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  if (authorized || pathname.startsWith("/handler")) return children;

  return (
    <div className="flex flex-1 items-center justify-center p-4">
      <p className="text-zinc-800 dark:text-zinc-200">
        This email is not authorized to use Chinese Flashcards.
      </p>
    </div>
  );
}
