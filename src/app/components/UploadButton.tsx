"use client";

import { useState } from "react";
import { parsePlecoXML } from "@/lib/parsePlecoXML";
import { newWord } from "@/lib/schema";
import { putWord } from "@/lib/storage";
import { ensureWords } from "@/lib/sync";

export default function UploadButton() {
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.xml')) {
      setMessage('Please upload an XML file');
      setTimeout(() => setMessage(null), 3000);
      return;
    }

    setUploading(true);
    setMessage(null);

    try {
      const content = await file.text();
      const parsed = parsePlecoXML(content);

      const words = await Promise.all(
        parsed.map(async ({ chinese, pinyin, english }) =>
          putWord(newWord({ chinese, pinyin, english: english || null }))
        )
      );

      try {
        await ensureWords(words);
        setMessage(`✅ Successfully imported ${words.length} words!`);
      } catch {
        setMessage(`✅ Imported ${words.length} words locally. Will sync when online.`);
      }

      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (error) {
      console.error('Upload error:', error);
      setMessage('❌ Failed to import file');
    } finally {
      setUploading(false);
      event.target.value = '';
      setTimeout(() => setMessage(null), 5000);
    }
  };

  return (
    <div className="flex items-center gap-2">
      {message && (
        <span className="text-xs text-zinc-600 dark:text-zinc-400">
          {message}
        </span>
      )}
      <label className="cursor-pointer">
        <input
          type="file"
          accept=".xml"
          onChange={handleFileUpload}
          disabled={uploading}
          className="hidden"
        />
        <span className={`text-blue-600 dark:text-blue-400 hover:underline text-sm ${
          uploading ? 'opacity-50 cursor-not-allowed' : ''
        }`}>
          {uploading ? 'Uploading...' : 'Upload'}
        </span>
      </label>
    </div>
  );
}

