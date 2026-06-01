import { clearAll } from './storage';

export async function signOutAndWipe(): Promise<void> {
  await clearAll();
  // Purge SW caches so cached HTML from this user's session is not served to
  // the next person who opens the app on this device. We do NOT unregister the
  // SW: unregistration fires a controllerchange event that ServiceWorkerRegistrar
  // handles by calling window.location.reload(), which races and wins against the
  // sign-out navigation, preventing the Stack session cookie from being cleared.
  if ('caches' in window) {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => caches.delete(k)));
  }
  window.location.href = '/handler/sign-out';
}
