import { clearAll } from './storage';

export async function signOutAndWipe(): Promise<void> {
  await clearAll();
  window.location.href = '/handler/sign-out';
}
