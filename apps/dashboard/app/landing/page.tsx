import { redirect } from 'next/navigation';

// Redirect legacy landing route to the root landing page.
export default function LandingRedirect() {
  redirect('/');
}
