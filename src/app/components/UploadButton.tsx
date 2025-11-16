"use client";

import { useState } from "react";

export default function UploadButton() {
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.name.endsWith('.xml')) {
      setMessage('Please upload an XML file');
      setTimeout(() => setMessage(null), 3000);
      return;
    }

    setUploading(true);
    setMessage(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/words/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        setMessage(`✅ Successfully imported ${data.count} words!`);
        // Refresh the page to show new words
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      } else {
        setMessage(`❌ Error: ${data.error || 'Failed to upload file'}`);
      }
    } catch (error) {
      console.error('Upload error:', error);
      setMessage('❌ Failed to upload file');
    } finally {
      setUploading(false);
      // Clear the input so the same file can be selected again
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

