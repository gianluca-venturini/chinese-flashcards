"use client";

import { signOutAndWipe } from "@/lib/signOut";

export default function SignOutButton() {
  const handleSignOut = async () => {
    if (!confirm("Sign out will erase all local data on this device. Continue?")) return;
    await signOutAndWipe();
  };

  return (
    <button
      onClick={handleSignOut}
      className="text-blue-600 dark:text-blue-400 hover:underline text-sm"
    >
      Logout
    </button>
  );
}
