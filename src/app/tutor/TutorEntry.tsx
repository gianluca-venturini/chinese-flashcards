'use client';

import { Message, MessageContent } from '@/components/ai-elements/message';
import type { ConversationEntry } from '@/lib/tutor/types';

export function TutorEntry({ entry }: { entry: ConversationEntry }) {
  if (entry.kind === 'utterance') {
    return (
      <Message from="assistant">
        <MessageContent className="bg-muted rounded-lg px-4 py-3">
          <span className="text-muted-foreground mb-1 block text-xs font-medium">
            🎓 李老师
          </span>
          <span className="block text-2xl leading-snug font-medium">{entry.hanzi}</span>
          {entry.pinyin && (
            <span className="text-muted-foreground block text-base">{entry.pinyin}</span>
          )}
          {entry.english && (
            <span className="text-muted-foreground/80 block text-sm italic">{entry.english}</span>
          )}
        </MessageContent>
      </Message>
    );
  }

  if (entry.kind === 'learner') {
    return (
      <Message from="user">
        <MessageContent>
          <span className="text-muted-foreground mb-1 block text-xs font-medium">🎤 You</span>
          <span className="block">{entry.text}</span>
        </MessageContent>
      </Message>
    );
  }

  // Correction entries are rendered in task 6.5.
  return null;
}
