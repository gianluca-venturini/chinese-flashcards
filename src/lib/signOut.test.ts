import 'fake-indexeddb/auto';
import { describe, expect, test, beforeEach } from 'bun:test';
import { signOutAndWipe } from './signOut';
import { putWord, getAllWords, clearAll } from './storage';
import { newWord } from './schema';

// Stub window.location for the Node/bun test environment
const locationStub = { href: '' };
(globalThis as unknown as { window: unknown }).window = { location: locationStub };

beforeEach(async () => {
  await clearAll();
  locationStub.href = '';
});

describe('signOutAndWipe', () => {
  test('getAllWords returns [] after the call', async () => {
    await putWord(newWord({ chinese: '你好', pinyin: 'nǐ hǎo' }));
    await putWord(newWord({ chinese: '谢谢', pinyin: 'xiè xie' }));
    await signOutAndWipe();
    expect(await getAllWords()).toHaveLength(0);
  });

  test('window.location.href points at the Stack sign-out handler', async () => {
    await signOutAndWipe();
    expect(locationStub.href).toBe('/handler/sign-out');
  });
});
