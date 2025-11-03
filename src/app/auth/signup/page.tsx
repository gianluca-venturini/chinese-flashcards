"use client";

import { SignUp } from "@stackframe/stack";

export default function SignUpPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-zinc-900 dark:text-white">
            Join Chinese Flashcards
          </h2>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Create an account to start learning Chinese
          </p>
        </div>
        <SignUp />
      </div>
    </div>
  );
}

