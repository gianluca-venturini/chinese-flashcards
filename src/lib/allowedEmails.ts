/** Emails that can use the app. Everyone else is rejected after sign-in. */
export const ALLOWED_EMAILS = ['gianluca.91@gmail.com'];

export const EMAIL_NOT_AUTHORIZED = 'Email not authorized';

type AuthUser = {
  primaryEmail: string | null;
  primaryEmailVerified: boolean;
};

export function isAuthorizedUser(user: AuthUser): boolean {
  // Require a verified email: otherwise anyone could sign up with a password
  // using an allowed address without owning it.
  if (!user.primaryEmail || !user.primaryEmailVerified) return false;
  return ALLOWED_EMAILS.includes(user.primaryEmail.toLowerCase());
}
