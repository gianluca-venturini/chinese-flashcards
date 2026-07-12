'use client';

import { useTutorSession } from '@/lib/tutor/useTutorSession';
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from '@/components/ai-elements/conversation';
import { Button } from '@/components/ui/button';

export default function TutorClient() {
  const session = useTutorSession();
  const { state, entries, start } = session;

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
            // Entry rendering is added in tasks 6.4 / 6.5.
            entries.map((entry) => <div key={entry.id} />)
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <div className="border-t p-4">
        <div className="mx-auto flex w-full max-w-2xl items-center justify-center">
          {state === 'idle' ? (
            <Button onClick={() => start()}>● Start session</Button>
          ) : (
            <span className="text-muted-foreground text-sm capitalize">{state}</span>
          )}
        </div>
      </div>
    </div>
  );
}
