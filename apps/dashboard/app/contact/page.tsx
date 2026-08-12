import type { Metadata } from 'next';
import { Suspense } from 'react';
import ContactClient from './contact-client';

export const metadata: Metadata = {
  title: 'Contact Us | E-Moto Operations Desk',
  description: 'Get in touch with our Kigali support lab to schedule a live demo, request API credentials, or integrate telemetry insurance. Our team is available 24/7 for dispatch emergencies.',
  keywords: [
    'contact e-moto',
    'Kigali operations desk',
    'eMoto office KN 78 St',
    'telemetry demo request',
    'fleet support Rwanda',
  ],
  alternates: {
    canonical: '/contact',
  },
};

export default function ContactPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#07090e]" />}>
      <ContactClient />
    </Suspense>
  );
}
