import type { Metadata } from 'next';
import LandingContent from './landing-content';

export const metadata: Metadata = {
  title: 'eMoto Fleet OS | Smart Safety & Telematics Command Center',
  description: 'Real-time safety, tracking, and B2B SaaS operations management for electric motorcycle fleets in Kigali, Rwanda. Automate leasing, protect vehicle assets, and increase rider safety.',
  keywords: [
    'e-moto Rwanda',
    'electric motorcycle Kigali',
    'motorcycle taxi GPS tracking',
    'Kigali logistics tracking',
    'electric bike lease-to-own',
    'Rwanda IoT telematics',
    'e-moto fleet management',
  ],
  alternates: {
    canonical: '/',
  },
};

// Maps the dashboard root route to the public landing experience.
export default function HomePage() {
  return <LandingContent />;
}
