"use client";

import UploadButton from "../components/UploadButton";
import ClassifyButton from "../components/ClassifyButton";
import ResetStatsButton from "../components/ResetStatsButton";
import SyncSection from "../components/SyncSection";
import WordStats from "../components/WordStats";

export default function AdminPage() {
  return (
    <div className="flex flex-1 w-full items-center justify-center bg-zinc-50 p-4 font-sans dark:bg-black">
      <div className="max-w-2xl w-full">
        <h1 className="mb-8 text-3xl font-bold text-zinc-900 dark:text-zinc-100">
          Admin Panel
        </h1>
        <div className="space-y-6">
          <div className="rounded-lg bg-white p-6 shadow-lg dark:bg-zinc-900">
            <h2 className="mb-4 text-xl font-semibold text-zinc-900 dark:text-zinc-100">
              Word Management
            </h2>
            <div className="flex flex-col gap-4">
              <UploadButton />
              <ClassifyButton />
            </div>
          </div>
          <div className="rounded-lg bg-white p-6 shadow-lg dark:bg-zinc-900">
            <h2 className="mb-4 text-xl font-semibold text-zinc-900 dark:text-zinc-100">
              Statistics
            </h2>
            <div className="flex flex-col gap-4">
              <WordStats />
              <ResetStatsButton />
            </div>
          </div>
          <div className="rounded-lg bg-white p-6 shadow-lg dark:bg-zinc-900">
            <h2 className="mb-4 text-xl font-semibold text-zinc-900 dark:text-zinc-100">
              Sync
            </h2>
            <SyncSection />
          </div>
        </div>
      </div>
    </div>
  );
}

