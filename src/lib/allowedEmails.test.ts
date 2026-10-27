import { describe, expect, test } from 'bun:test';
import { isAuthorizedUser } from './allowedEmails';

describe('isAuthorizedUser', () => {
  test('accepts a verified allowed email', () => {
    expect(isAuthorizedUser({ primaryEmail: 'gianluca.91@gmail.com', primaryEmailVerified: true })).toBe(true);
  });

  test('ignores email case', () => {
    expect(isAuthorizedUser({ primaryEmail: 'Gianluca.91@Gmail.com', primaryEmailVerified: true })).toBe(true);
  });

  test('rejects an email that is not on the list', () => {
    expect(isAuthorizedUser({ primaryEmail: 'someone@example.com', primaryEmailVerified: true })).toBe(false);
  });

  test('rejects an allowed email that is not verified', () => {
    expect(isAuthorizedUser({ primaryEmail: 'gianluca.91@gmail.com', primaryEmailVerified: false })).toBe(false);
  });

  test('rejects a user with no email', () => {
    expect(isAuthorizedUser({ primaryEmail: null, primaryEmailVerified: false })).toBe(false);
  });
});
