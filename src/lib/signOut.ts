import { clearAll } from './storage';

export async function signOutAndWipe(): Promise<void> {
  await clearAll();
  // Purge SW caches and unregister so cached HTML from this user's session
  // is not served to the next person who opens the app on this device.
  if ('caches' in window) {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => caches.delete(k)));
  }
  if ('serviceWorker' in navigator) {
    const reg = await navigator.serviceWorker.getRegistration();
    await reg?.unregister();
  }
  window.location.href = '/handler/sign-out';
}
