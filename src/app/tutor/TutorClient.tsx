'use client';

import { useTutorSession } from '@/lib/tutor/useTutorSession';
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from '@/components/ai-elements/conversation';
import { TutorDock } from './TutorDock';
import { TutorEntry } from './TutorEntry';

export default function TutorClient() {
  const session = useTutorSession();
  const { entries } = session;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <Conversation className="flex-1">
        <ConversationContent className="mx-auto w-full max-w-2xl">
          {entries.length === 0 ? (
            <ConversationEmptyState
              title="和李老师说中文"
              description="Start a session and talk with your Mandarin tutor. Speak naturally — 李老师 hears your tones."
            />
          ) : (
            <div className="flex flex-col gap-4">
              {entries.map((entry) => (
                <TutorEntry key={entry.id} entry={entry} />
              ))}
            </div>
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <TutorDock session={session} />
    </div>
  );
}
