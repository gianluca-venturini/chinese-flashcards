"use client";
import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { CUSTOM_SIZE_PARAM, SESSION_ORDER_PARAM, type SessionOrder } from "@/lib/sessionParams";

const DEFAULT_INPUT = "10";

const ORDER_LABELS: { [key in SessionOrder]: string } = {
  chronological: "Next chronological",
  difficult: "Most difficult first",
};

export default function CustomSessionMenuItem() {
  const router = useRouter();
  const [showDialog, setShowDialog] = useState<boolean>(false);
  const [input, setInput] = useState<string>(DEFAULT_INPUT);
  const [order, setOrder] = useState<SessionOrder>("chronological");

  const openDialog = useCallback(() => {
    setInput(DEFAULT_INPUT);
    setOrder("chronological");
    setShowDialog(true);
  }, []);

  const closeDialog = useCallback(() => {
    setShowDialog(false);
  }, []);

  const parsed = parseInt(input, 10);
  const isValid = Number.isFinite(parsed) && parsed >= 1;

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!isValid) return;
      setShowDialog(false);
      router.push(`/?${CUSTOM_SIZE_PARAM}=${parsed}&${SESSION_ORDER_PARAM}=${order}`);
    },
    [isValid, parsed, order, router]
  );

  return (
    <>
      <button
        type="button"
        onClick={openDialog}
        className="text-blue-600 dark:text-blue-400 hover:underline text-sm"
      >
        Custom
      </button>
      {showDialog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
          onClick={closeDialog}
        >
          <div
            className="bg-white dark:bg-zinc-800 rounded-lg p-6 shadow-xl max-w-md w-full mx-4 select-text"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-4">
              Custom Session
            </h2>
            <form onSubmit={handleSubmit}>
              <label className="block mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                How many words?
              </label>
              <input
                type="number"
                min={1}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                required
                autoFocus
              />
              <label className="block mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Order
              </label>
              <div className="flex rounded-lg border border-zinc-300 dark:border-zinc-600 overflow-hidden mb-4">
                {(["chronological", "difficult"] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setOrder(value)}
                    className={`flex-1 px-3 py-2 text-sm font-medium ${order === value ? "bg-blue-600 text-white" : "bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700"}`}
                  >
                    {ORDER_LABELS[value]}
                  </button>
                ))}
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={closeDialog}
                  className="px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 bg-zinc-200 dark:bg-zinc-700 rounded-md hover:bg-zinc-300 dark:hover:bg-zinc-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!isValid}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Start
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
