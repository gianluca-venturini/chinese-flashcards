"use client";

import { SignIn } from "@stackframe/stack";

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-zinc-900 dark:text-white">
            Sign in to Chinese Flashcards
          </h2>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Learn Chinese with interactive flashcards
          </p>
        </div>
        <SignIn />
      </div>
    </div>
  );
}

