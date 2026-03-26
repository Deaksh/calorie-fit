import './globals.css';
import type { ReactNode } from 'react';

export const metadata = {
  title: 'CalorieFit',
  description: 'Personalized nutrition and AI coaching.'
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
