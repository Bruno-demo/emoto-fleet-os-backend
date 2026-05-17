import { cookies } from 'next/headers';
import LandingContent from './landing-content';

// Maps the dashboard root route to the public landing experience.
export default async function HomePage() {
  const cookieStore = await cookies();
  const authCookieName = process.env.AUTH_COOKIE_NAME ?? 'emoto_access_token';
  const hasSession = Boolean(cookieStore.get(authCookieName)?.value);
  return <LandingContent hasSession={hasSession} />;
}

