import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { StackProvider, StackTheme } from "@stackframe/stack";
import { stackServerApp } from "@/stack";
import Link from "next/link";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Chinese Flashcards",
  description: "Learn Chinese with flashcards",
};

async function UserInfoBar() {
  const user = await stackServerApp.getUser();

  if (!user) {
    return (
      <div className="bg-zinc-100 dark:bg-zinc-900 px-4 py-2 flex justify-between items-center">
        <span className="text-zinc-800 dark:text-zinc-200 text-sm">
          Welcome to Chinese Flashcards
        </span>
        <a
          href="/auth/signin"
          className="text-blue-600 dark:text-blue-400 hover:underline text-sm"
        >
          Sign in
        </a>
      </div>
    );
  }

  return (
    <div className="bg-zinc-100 dark:bg-zinc-900 px-4 py-2 flex justify-between items-center">
      <span className="text-zinc-800 dark:text-zinc-200 text-sm">
        Welcome, {user.displayName || user.primaryEmail}!
      </span>
      <div className="flex items-center gap-4">
        <Link
          href="/words"
          className="text-blue-600 dark:text-blue-400 hover:underline text-sm"
        >
          List
        </Link>
        <Link
          href="/admin"
          className="text-blue-600 dark:text-blue-400 hover:underline text-sm"
        >
          Admin
        </Link>
        <Link
          href="/handler/sign-out"
          className="text-blue-600 dark:text-blue-400 hover:underline text-sm"
        >
          Logout
        </Link>
      </div>
    </div>
  );
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <StackProvider app={stackServerApp}>
          <StackTheme>
            <UserInfoBar />
            {children}
          </StackTheme>
        </StackProvider>
      </body>
    </html>
  );
}
