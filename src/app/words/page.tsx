"use client";
import { useEffect, useMemo, useState } from "react";
import { type Word } from "@/lib/schema";
import { newWord } from "@/lib/schema";
import { CategoryId, CATEGORY_IDS, CATEGORY_META } from "@/lib/categories";
import { CATEGORY_COLORS, UNKNOWN_CATEGORY_COLOR } from "@/lib/colors";
import { getShortDefinition } from "@/lib/formatDefinition";
import { getAllWords, putWord } from "@/lib/storage";
import { syncFromServer, ensureWords } from "@/lib/sync";
import { translateWords, examplifyWords, generatePinyin } from "@/lib/apiClient";
import { lookupPinyinForWord, lookupPinyinForWords } from "@/lib/pinyinTable";

export default function WordsPage() {
  const [words, setWords] = useState<Word[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [hoveredWord, setHoveredWord] = useState<Word | null>(null);
  const [editingWord, setEditingWord] = useState<Word | null>(null);
  const [viewMode, setViewMode] = useState<'tiles' | 'table'>('tiles');
  const [showAdvancedColumns, setShowAdvancedColumns] = useState<boolean>(false);
  const [showDeprecated, setShowDeprecated] = useState<boolean>(false);
  const [selectedWords, setSelectedWords] = useState<Set<string>>(new Set());
  const [isTranslating, setIsTranslating] = useState<boolean>(false);
  const [isGeneratingExamples, setIsGeneratingExamples] = useState<boolean>(false);
  const [englishValue, setEnglishValue] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [newChinese, setNewChinese] = useState<string>("");
  const [newEnglish, setNewEnglish] = useState<string>("");
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [csvCopied, setCsvCopied] = useState<boolean>(false);
  const [showBulkAddModal, setShowBulkAddModal] = useState<boolean>(false);
  const [bulkCsv, setBulkCsv] = useState<string>("");
  const [bulkStep, setBulkStep] = useState<'input' | 'preview'>('input');
  const [bulkPreview, setBulkPreview] = useState<{ chinese: string; pinyin: string; isDuplicate: boolean }[]>([]);
  const [isBulkLoading, setIsBulkLoading] = useState<boolean>(false);
  const [isBulkCreating, setIsBulkCreating] = useState<boolean>(false);

  const visibleWords = useMemo(
    () => (showDeprecated ? words : words.filter((w) => !w.deprecated)),
    [words, showDeprecated],
  );

  async function refreshWords() {
    const allWords = await getAllWords();
    setWords(allWords);
  }

  useEffect(() => {
    async function loadWords() {
      try {
        await syncFromServer();
      } catch (err) {
        console.warn('Sync from server failed, using local data:', err);
      }
      try {
        await refreshWords();
      } catch (err) {
        console.error('Error loading words from storage:', err);
        setError('Failed to load words');
      } finally {
        setLoading(false);
      }
    }

    void loadWords();

  }, []);

  const handleWordClick = (word: Word) => {
    setEditingWord(word);
    setEnglishValue(word.english ?? "");
  };

  const handleToggleDeprecated = async (word: Word) => {
    try {
      const updated = await putWord({ ...word, deprecated: !word.deprecated });
      try {
        await ensureWords([updated]);
      } catch {
        // Local toggle preserved; will sync later
      }
      await refreshWords();
      setSelectedWords((prev) => {
        if (!prev.has(word.chinese)) return prev;
        const next = new Set(prev);
        next.delete(word.chinese);
        return next;
      });
    } catch (err) {
      console.error('Error toggling deprecated:', err);
      alert('Failed to update word');
    }
  };

  const handleDialogClose = () => {
    setEditingWord(null);
    setEnglishValue("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingWord) return;

    setIsSubmitting(true);
    try {
      const updated = await putWord({ ...editingWord, english: englishValue || null });
      try {
        await ensureWords([updated]);
      } catch {
        // Local edit preserved; will sync later
      }
      await refreshWords();
      handleDialogClose();
    } catch (err) {
      console.error('Error updating word:', err);
      alert('Failed to update word');
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleWordSelection = (chinese: string) => {
    setSelectedWords((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(chinese)) {
        newSet.delete(chinese);
      } else {
        newSet.add(chinese);
      }
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    if (selectedWords.size === visibleWords.length) {
      setSelectedWords(new Set());
    } else {
      setSelectedWords(new Set(visibleWords.map((w) => w.chinese)));
    }
  };

  const handleImproveTranslation = async () => {
    const selected = words.filter((w) => selectedWords.has(w.chinese));
    if (selected.length === 0) return;

    setIsTranslating(true);
    try {
      const translations = await translateWords(selected.map((w) => w.chinese));

      const updatedWords = await Promise.all(
        translations.map(async ({ word: chinese, english }) => {
          const word = words.find((w) => w.chinese === chinese);
          if (!word) return null;
          return putWord({ ...word, english });
        })
      );

      const validWords = updatedWords.filter((w): w is NonNullable<typeof w> => w !== null);

      try {
        await ensureWords(validWords);
      } catch {
        // Local updates preserved; will sync later
      }

      await refreshWords();
      setSelectedWords(new Set());
    } catch (err) {
      console.error('Error translating words:', err);
      alert('Failed to translate words');
    } finally {
      setIsTranslating(false);
    }
  };

  const handleAddExamples = async () => {
    const selected = words.filter((w) => selectedWords.has(w.chinese));
    if (selected.length === 0) return;

    setIsGeneratingExamples(true);
    try {
      const knownWords = words.filter((w) => w.english !== null);
      const examples = await examplifyWords(
        selected.map((w) => w.chinese),
        knownWords.map((w) => w.chinese)
      );

      const updatedWords = await Promise.all(
        examples.map(async ({ word: chinese, example_chinese, example_pinyin }) => {
          const word = words.find((w) => w.chinese === chinese);
          if (!word) return null;
          return putWord({ ...word, example_chinese, example_pinyin });
        })
      );

      const validWords = updatedWords.filter((w): w is NonNullable<typeof w> => w !== null);

      try {
        await ensureWords(validWords);
      } catch {
        // Local updates preserved; will sync later
      }

      await refreshWords();
      setSelectedWords(new Set());
    } catch (err) {
      console.error('Error generating examples:', err);
      alert('Failed to generate examples');
    } finally {
      setIsGeneratingExamples(false);
    }
  };

  const handleCopyCSV = async () => {
    const csv = words.map((w) => w.chinese).join(',');
    await navigator.clipboard.writeText(csv);
    setCsvCopied(true);
    setTimeout(() => setCsvCopied(false), 2000);
  };

  const closeBulkModal = () => {
    setShowBulkAddModal(false);
    setBulkCsv("");
    setBulkStep('input');
    setBulkPreview([]);
  };

  const parseBulkCsv = (raw: string): string[] => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const piece of raw.split(/[,\n\r\t]+/)) {
      const trimmed = piece.trim();
      if (!trimmed || seen.has(trimmed)) continue;
      seen.add(trimmed);
      out.push(trimmed);
    }
    return out;
  };

  const handleBulkContinue = async () => {
    const entries = parseBulkCsv(bulkCsv);
    if (entries.length === 0) return;
    setIsBulkLoading(true);
    try {
      const existing = new Set(words.map((w) => w.chinese));
      let pinyinByWord = new Map<string, string>();
      try {
        const results = await lookupPinyinForWords(entries);
        pinyinByWord = new Map(results.map((r) => [r.word, r.pinyin]));
      } catch (err) {
        console.warn('Pinyin lookup failed, using hanzi as fallback:', err);
      }
      const preview = entries.map((chinese) => ({
        chinese,
        pinyin: pinyinByWord.get(chinese) ?? chinese,
        isDuplicate: existing.has(chinese),
      }));
      setBulkPreview(preview);
      setBulkStep('preview');
    } catch (err) {
      console.error('Error preparing bulk preview:', err);
      alert('Failed to prepare preview');
    } finally {
      setIsBulkLoading(false);
    }
  };

  const handleBulkConfirm = async () => {
    const toCreate = bulkPreview.filter((p) => !p.isDuplicate);
    if (toCreate.length === 0) return;
    setIsBulkCreating(true);
    try {
      const created = await Promise.all(
        toCreate.map((p) =>
          putWord(newWord({ chinese: p.chinese, pinyin: p.pinyin })),
        ),
      );
      try {
        await ensureWords(created);
      } catch {
        // Local creates preserved; will sync later
      }
      await refreshWords();
      setSelectedWords(new Set(created.map((w) => w.chinese)));
      setViewMode('table');
      closeBulkModal();
    } catch (err) {
      console.error('Error bulk creating words:', err);
      alert('Failed to create words');
    } finally {
      setIsBulkCreating(false);
    }
  };

  const handleAddWord = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);
    try {
      let pinyin = newChinese;
      try {
        const lookup = await lookupPinyinForWord(newChinese);
        if (lookup.complete) {
          pinyin = lookup.pinyin;
        } else {
          const pinyins = await generatePinyin([newChinese]);
          pinyin = pinyins[0]?.pinyin ?? lookup.pinyin;
        }
      } catch (err) {
        console.warn('Pinyin lookup failed, falling back to API:', err);
        const pinyins = await generatePinyin([newChinese]);
        pinyin = pinyins[0]?.pinyin ?? newChinese;
      }
      const word = await putWord(newWord({ chinese: newChinese, pinyin, english: newEnglish || null }));
      try {
        await ensureWords([word]);
      } catch {
        // Local create preserved; will sync later
      }
      await refreshWords();
      setShowAddModal(false);
      setNewChinese("");
      setNewEnglish("");
    } catch (err) {
      console.error('Error creating word:', err);
      alert('Failed to add word');
    } finally {
      setIsCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-1 w-full items-center justify-center bg-zinc-50 p-4 font-sans dark:bg-black">
        <div className="text-xl text-zinc-600 dark:text-zinc-400">Loading words...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-1 w-full items-center justify-center bg-zinc-50 p-4 font-sans dark:bg-black">
        <div className="text-xl text-red-600 dark:text-red-400">{error}</div>
      </div>
    );
  }

  return (
    <div
      className="flex-1 w-full overflow-auto bg-zinc-50 p-4 font-sans dark:bg-black select-none"
      onTouchStart={(e) => {
        if (hoveredWord && !(e.target as HTMLElement).closest('[data-word-card]')) {
          setHoveredWord(null);
        }
      }}
      onClick={(e) => {
        if (hoveredWord && !(e.target as HTMLElement).closest('[data-word-card]')) {
          setHoveredWord(null);
        }
      }}
    >
      <div className="mx-auto max-w-7xl">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">
            All Words ({visibleWords.length})
          </h1>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAddModal(true)}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
            >
            Add Word
            </button>
            <button
              onClick={() => setShowBulkAddModal(true)}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
            >
            Add multiple
            </button>
            <div className="flex rounded-lg border border-zinc-300 dark:border-zinc-600 overflow-hidden">
              <button
                onClick={() => setViewMode('tiles')}
                className={`p-2 ${viewMode === 'tiles' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700'}`}
                title="Tiles view"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="7" height="7" />
                  <rect x="14" y="3" width="7" height="7" />
                  <rect x="3" y="14" width="7" height="7" />
                  <rect x="14" y="14" width="7" height="7" />
                </svg>
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`p-2 ${viewMode === 'table' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700'}`}
                title="Table view"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="18" x2="21" y2="18" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {viewMode === 'tiles' ? (
          <>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(1.5rem,1fr))] gap-1 relative">
              {visibleWords.map((word, index) => {
                const categoryColor =
              CATEGORY_COLORS[word.category as CategoryId] ?? UNKNOWN_CATEGORY_COLOR;
                const charCount = word.chinese.length;
                return (
                  <div
                    key={`${word.chinese}-${index}`}
                    data-word-card
                    className={`flex items-center justify-center rounded p-0.5 shadow-sm transition-shadow hover:shadow-md cursor-pointer relative ${word.deprecated ? 'opacity-40' : ''}`}
                    style={{
                      backgroundColor: categoryColor,
                      gridColumn: charCount > 1 ? `span ${Math.min(charCount, 3)}` : 'span 1',
                      aspectRatio: charCount === 1 ? '1' : 'auto',
                      minHeight: '1.5rem'
                    }}
                    onMouseEnter={() => {
                      setHoveredWord(word);
                    }}
                    onMouseLeave={() => {
                      setHoveredWord(null);
                    }}
                    onClick={() => {
                      handleWordClick(word);
                    }}
                    onTouchStart={(e) => {
                      e.stopPropagation();
                      setHoveredWord(word);
                    }}
                  >
                    <span className={`text-[10px] font-semibold text-zinc-900 sm:text-xs whitespace-nowrap ${word.deprecated ? 'line-through' : ''}`}>
                      {word.chinese}
                    </span>
                  </div>
                );
              })}
            </div>
            {hoveredWord && (
              <div
                data-word-card
                className="fixed z-50 pointer-events-none"
                style={{
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                }}
              >
                <div
                  className="flex flex-col items-center justify-center rounded-2xl p-8 shadow-2xl min-w-[300px] max-w-[90vw]"
                  style={{
                    backgroundColor: CATEGORY_COLORS[hoveredWord.category as CategoryId] ?? UNKNOWN_CATEGORY_COLOR,
                  }}
                >
                  <h1 className="text-5xl font-bold text-zinc-900 mb-4">
                    {hoveredWord.chinese}
                  </h1>
                  <p className="text-xl text-zinc-900 mb-2">
                    {hoveredWord.pinyin}
                  </p>
                  <p className="text-lg text-zinc-900">
                    {hoveredWord.english ? getShortDefinition(hoveredWord.english) : ''}
                  </p>
                </div>
              </div>
            )}
            <div className="mt-6 pt-4 border-t border-zinc-200 dark:border-zinc-700">
              <div className="flex flex-wrap gap-x-4 gap-y-2">
                {CATEGORY_IDS.map((id) => (
                  <div key={id} className="inline-flex items-center gap-2">
                    <span
                      className="inline-block h-4 w-4 rounded border border-zinc-300 dark:border-zinc-600"
                      style={{ backgroundColor: CATEGORY_COLORS[id] }}
                    />
                    <span className="text-xs text-zinc-700 dark:text-zinc-300">
                      {CATEGORY_META[id].label}
                    </span>
                  </div>
                ))}
                <div className="inline-flex items-center gap-2">
                  <span
                    className="inline-block h-4 w-4 rounded border border-zinc-300 dark:border-zinc-600"
                    style={{ backgroundColor: UNKNOWN_CATEGORY_COLOR }}
                  />
                  <span className="text-xs text-zinc-700 dark:text-zinc-300">
                    Uncategorized
                  </span>
                </div>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="mb-4 flex gap-2 items-center sticky top-0 z-10 bg-zinc-50 dark:bg-black py-2">
              <button
                onClick={handleImproveTranslation}
                disabled={selectedWords.size === 0 || isTranslating || isGeneratingExamples}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isTranslating ? 'Translating...' : `Improve translation ${selectedWords.size > 0 ? `(${selectedWords.size})` : ''}`}
              </button>
              <button
                onClick={handleAddExamples}
                disabled={selectedWords.size === 0 || isGeneratingExamples || isTranslating}
                className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-md hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isGeneratingExamples ? 'Generating...' : `Add examples ${selectedWords.size > 0 ? `(${selectedWords.size})` : ''}`}
              </button>
              <button
                onClick={() => {
                  const word = visibleWords.find((w) => selectedWords.has(w.chinese));
                  if (word) handleWordClick(word);
                }}
                disabled={selectedWords.size !== 1 || isTranslating}
                className="px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 bg-zinc-200 dark:bg-zinc-700 rounded-md hover:bg-zinc-300 dark:hover:bg-zinc-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
            Edit manually
              </button>
              <button
                onClick={handleCopyCSV}
                disabled={words.length === 0}
                className="px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 bg-zinc-200 dark:bg-zinc-700 rounded-md hover:bg-zinc-300 dark:hover:bg-zinc-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {csvCopied ? 'Copied!' : 'Copy CSV'}
              </button>
              <div className="ml-auto flex items-center gap-4">
                <label className="text-sm text-zinc-600 dark:text-zinc-400 cursor-pointer flex items-center gap-2">
                  <span>Show deprecated</span>
                  <button
                    onClick={() => setShowDeprecated(!showDeprecated)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${showDeprecated ? 'bg-blue-600' : 'bg-zinc-300 dark:bg-zinc-600'}`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${showDeprecated ? 'translate-x-6' : 'translate-x-1'}`}
                    />
                  </button>
                </label>
                <label className="text-sm text-zinc-600 dark:text-zinc-400 cursor-pointer flex items-center gap-2">
                  <span>Show advanced</span>
                  <button
                    onClick={() => setShowAdvancedColumns(!showAdvancedColumns)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${showAdvancedColumns ? 'bg-blue-600' : 'bg-zinc-300 dark:bg-zinc-600'}`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${showAdvancedColumns ? 'translate-x-6' : 'translate-x-1'}`}
                    />
                  </button>
                </label>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse bg-white dark:bg-zinc-800 rounded-lg overflow-hidden shadow">
                <thead>
                  <tr className="bg-zinc-100 dark:bg-zinc-700">
                    <th className="px-4 py-3 text-left text-sm font-semibold text-zinc-900 dark:text-zinc-100 border-b border-zinc-200 dark:border-zinc-600 w-10">
                      <input
                        type="checkbox"
                        checked={selectedWords.size === visibleWords.length && visibleWords.length > 0}
                        onChange={toggleSelectAll}
                        className="w-4 h-4 rounded border-zinc-300 dark:border-zinc-600 cursor-pointer"
                      />
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-zinc-900 dark:text-zinc-100 border-b border-zinc-200 dark:border-zinc-600">Chinese</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-zinc-900 dark:text-zinc-100 border-b border-zinc-200 dark:border-zinc-600">Pinyin</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-zinc-900 dark:text-zinc-100 border-b border-zinc-200 dark:border-zinc-600">English</th>
                    {showAdvancedColumns && (
                      <>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-zinc-900 dark:text-zinc-100 border-b border-zinc-200 dark:border-zinc-600">
                          <span className="flex items-center gap-1">
                        Created
                            <span className="relative cursor-help text-zinc-400 group">
                              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="10" />
                                <path d="M12 16v-4" />
                                <path d="M12 8h.01" />
                              </svg>
                              <span className="absolute left-1/2 -translate-x-1/2 top-6 z-20 hidden group-hover:block w-48 p-2 text-xs font-normal text-white bg-zinc-800 dark:bg-zinc-700 rounded shadow-lg">
                            Date when the word was added
                              </span>
                            </span>
                          </span>
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-zinc-900 dark:text-zinc-100 border-b border-zinc-200 dark:border-zinc-600">
                          <span className="flex items-center gap-1">
                        Category
                            <span className="relative cursor-help text-zinc-400 group">
                              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="10" />
                                <path d="M12 16v-4" />
                                <path d="M12 8h.01" />
                              </svg>
                              <span className="absolute left-1/2 -translate-x-1/2 top-6 z-20 hidden group-hover:block w-48 p-2 text-xs font-normal text-white bg-zinc-800 dark:bg-zinc-700 rounded shadow-lg">
                            Semantic category for color coding
                              </span>
                            </span>
                          </span>
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-zinc-900 dark:text-zinc-100 border-b border-zinc-200 dark:border-zinc-600">
                          <span className="flex items-center gap-1">
                        Interval
                            <span className="relative cursor-help text-zinc-400 group">
                              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="10" />
                                <path d="M12 16v-4" />
                                <path d="M12 8h.01" />
                              </svg>
                              <span className="absolute left-1/2 -translate-x-1/2 top-6 z-20 hidden group-hover:block w-48 p-2 text-xs font-normal text-white bg-zinc-800 dark:bg-zinc-700 rounded shadow-lg">
                            Days until next review (SM-2 algorithm)
                              </span>
                            </span>
                          </span>
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-zinc-900 dark:text-zinc-100 border-b border-zinc-200 dark:border-zinc-600">
                          <span className="flex items-center gap-1">
                        EF
                            <span className="relative cursor-help text-zinc-400 group">
                              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="10" />
                                <path d="M12 16v-4" />
                                <path d="M12 8h.01" />
                              </svg>
                              <span className="absolute left-1/2 -translate-x-1/2 top-6 z-20 hidden group-hover:block w-56 p-2 text-xs font-normal text-white bg-zinc-800 dark:bg-zinc-700 rounded shadow-lg">
                            Easiness Factor (1.3-2.5+): higher = easier, shown less often
                              </span>
                            </span>
                          </span>
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-zinc-900 dark:text-zinc-100 border-b border-zinc-200 dark:border-zinc-600">
                          <span className="flex items-center gap-1">
                        Reps
                            <span className="relative cursor-help text-zinc-400 group">
                              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="10" />
                                <path d="M12 16v-4" />
                                <path d="M12 8h.01" />
                              </svg>
                              <span className="absolute left-1/2 -translate-x-1/2 top-6 z-20 hidden group-hover:block w-56 p-2 text-xs font-normal text-white bg-zinc-800 dark:bg-zinc-700 rounded shadow-lg">
                            Consecutive successful reviews (resets to 0 on failure)
                              </span>
                            </span>
                          </span>
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-zinc-900 dark:text-zinc-100 border-b border-zinc-200 dark:border-zinc-600">Example</th>
                      </>
                    )}
                    <th className="px-4 py-3 text-right text-sm font-semibold text-zinc-900 dark:text-zinc-100 border-b border-zinc-200 dark:border-zinc-600 w-32">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleWords.map((word, index) => (
                    <tr
                      key={`${word.chinese}-${index}`}
                      className={`border-b border-zinc-100 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-750 cursor-pointer ${selectedWords.has(word.chinese) ? 'bg-blue-50 dark:bg-blue-900/20' : ''} ${word.deprecated ? 'opacity-50' : ''}`}
                      onClick={() => toggleWordSelection(word.chinese)}
                    >
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedWords.has(word.chinese)}
                          onChange={() => toggleWordSelection(word.chinese)}
                          className="w-4 h-4 rounded border-zinc-300 dark:border-zinc-600 cursor-pointer"
                        />
                      </td>
                      <td className={`px-4 py-3 text-zinc-900 dark:text-zinc-100 font-medium ${word.deprecated ? 'line-through' : ''}`}>{word.chinese}</td>
                      <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{word.pinyin}</td>
                      <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                        {word.english ? getShortDefinition(word.english) : ''}
                      </td>
                      {showAdvancedColumns && (
                        <>
                          <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400 text-sm">
                            {new Date(word.created_at).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400 text-sm">
                            {word.category || '-'}
                          </td>
                          <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400 text-sm">
                            {word.i} days
                          </td>
                          <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400 text-sm">
                            {word.ef?.toFixed(2) || '-'}
                          </td>
                          <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400 text-sm">
                            {word.n}
                          </td>
                          <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400 text-sm">
                            {word.example_chinese ? (
                              <>
                                <span>{word.example_chinese}</span>
                                <span className="ml-2 text-xs text-zinc-400 dark:text-zinc-500">{word.example_pinyin}</span>
                              </>
                            ) : '-'}
                          </td>
                        </>
                      )}
                      <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => handleToggleDeprecated(word)}
                          className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                            word.deprecated
                              ? 'text-green-700 dark:text-green-300 bg-green-100 dark:bg-green-900/30 hover:bg-green-200 dark:hover:bg-green-900/50'
                              : 'text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/30 hover:bg-amber-200 dark:hover:bg-amber-900/50'
                          }`}
                        >
                          {word.deprecated ? 'Restore' : 'Deprecate'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Bulk Add Modal */}
      {showBulkAddModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
          onClick={closeBulkModal}
        >
          <div
            className="bg-white dark:bg-zinc-800 rounded-lg p-6 shadow-xl max-w-2xl w-full mx-4 select-text max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-4">
              {bulkStep === 'input' ? 'Add multiple words' : 'Preview new words'}
            </h2>
            {bulkStep === 'input' ? (
              <>
                <label className="block mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Paste hanzi separated by commas and/or newlines
                </label>
                <textarea
                  value={bulkCsv}
                  onChange={(e) => setBulkCsv(e.target.value)}
                  className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4 font-mono text-sm"
                  rows={10}
                  placeholder="你好, 谢谢, 早上&#10;晚上&#10;再见"
                  autoFocus
                  disabled={isBulkLoading}
                />
                <div className="flex gap-2 justify-end">
                  <button
                    type="button"
                    onClick={closeBulkModal}
                    className="px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 bg-zinc-200 dark:bg-zinc-700 rounded-md hover:bg-zinc-300 dark:hover:bg-zinc-600 transition-colors"
                    disabled={isBulkLoading}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleBulkContinue}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={isBulkLoading || parseBulkCsv(bulkCsv).length === 0}
                  >
                    {isBulkLoading ? 'Loading pinyin...' : 'Continue'}
                  </button>
                </div>
              </>
            ) : (
              <>
                {(() => {
                  const dupCount = bulkPreview.filter((p) => p.isDuplicate).length;
                  const newCount = bulkPreview.length - dupCount;
                  return (
                    <p className="mb-3 text-sm text-zinc-600 dark:text-zinc-400">
                      {bulkPreview.length} entries — {newCount} new, {dupCount} duplicate{dupCount === 1 ? '' : 's'}
                    </p>
                  );
                })()}
                <div className="flex-1 overflow-y-auto border border-zinc-200 dark:border-zinc-700 rounded-md mb-4">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-zinc-100 dark:bg-zinc-700">
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold text-zinc-900 dark:text-zinc-100">Hanzi</th>
                        <th className="px-3 py-2 text-left font-semibold text-zinc-900 dark:text-zinc-100">Pinyin</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bulkPreview.map((p) => (
                        <tr
                          key={p.chinese}
                          className={`border-t border-zinc-100 dark:border-zinc-700 ${p.isDuplicate ? 'bg-red-50 dark:bg-red-900/20' : ''}`}
                        >
                          <td className="px-3 py-2 text-zinc-900 dark:text-zinc-100 font-medium">
                            <span>{p.chinese}</span>
                            {p.isDuplicate && (
                              <span className="ml-2 inline-block px-1.5 py-0.5 text-[10px] font-bold rounded bg-red-600 text-white align-middle">
                                DUP!
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-zinc-600 dark:text-zinc-400">{p.pinyin}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => setBulkStep('input')}
                    className="px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 bg-zinc-200 dark:bg-zinc-700 rounded-md hover:bg-zinc-300 dark:hover:bg-zinc-600 transition-colors"
                    disabled={isBulkCreating}
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={closeBulkModal}
                    className="px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 bg-zinc-200 dark:bg-zinc-700 rounded-md hover:bg-zinc-300 dark:hover:bg-zinc-600 transition-colors"
                    disabled={isBulkCreating}
                  >
                    Cancel
                  </button>
                  {(() => {
                    const newCount = bulkPreview.filter((p) => !p.isDuplicate).length;
                    return (
                      <button
                        type="button"
                        onClick={handleBulkConfirm}
                        className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={isBulkCreating || newCount === 0}
                      >
                        {isBulkCreating ? 'Creating...' : newCount === 0 ? 'Nothing to add' : `Confirm (${newCount})`}
                      </button>
                    );
                  })()}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Add Word Modal */}
      {showAddModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
          onClick={() => setShowAddModal(false)}
        >
          <div
            className="bg-white dark:bg-zinc-800 rounded-lg p-6 shadow-xl max-w-md w-full mx-4 select-text"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-4">
              Add Word
            </h2>
            <form onSubmit={handleAddWord}>
              <label className="block mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Chinese
              </label>
              <input
                type="text"
                value={newChinese}
                onChange={(e) => setNewChinese(e.target.value)}
                className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
                required
                autoFocus
              />
              <label className="block mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                English <span className="text-zinc-400 font-normal">(optional)</span>
              </label>
              <input
                type="text"
                value={newEnglish}
                onChange={(e) => setNewEnglish(e.target.value)}
                className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
              />
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 bg-zinc-200 dark:bg-zinc-700 rounded-md hover:bg-zinc-300 dark:hover:bg-zinc-600 transition-colors"
                  disabled={isCreating}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={isCreating}
                >
                  {isCreating ? 'Adding...' : 'Add'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Dialog */}
      {editingWord && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
          onClick={handleDialogClose}
        >
          <div
            className="bg-white dark:bg-zinc-800 rounded-lg p-6 shadow-xl max-w-md w-full mx-4 select-text"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-4">
              Edit Translation
            </h2>
            <div className="mb-4">
              <p className="text-lg font-semibold text-zinc-700 dark:text-zinc-300 mb-2">
                {editingWord.chinese}
              </p>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
                {editingWord.pinyin}
              </p>
            </div>
            <form onSubmit={handleSubmit}>
              <label className="block mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                English Translation
              </label>
              <textarea
                value={englishValue}
                onChange={(e) => setEnglishValue(e.target.value)}
                className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
                rows={4}
              />
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={handleDialogClose}
                  className="px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 bg-zinc-200 dark:bg-zinc-700 rounded-md hover:bg-zinc-300 dark:hover:bg-zinc-600 transition-colors"
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
