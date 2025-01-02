import type { Metadata } from 'next';
import { Poppins, Rubik } from 'next/font/google';
import './globals.css';

const rubik = Rubik({
  variable: '--font-rubik',
  subsets: ['latin'],
  display: 'swap',
});

const poppins = Poppins({
  variable: '--font-poppins',
  subsets: ['latin'],
  weight: ['400', '700'],
  style: ['normal', 'italic'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Maqet',
  description: 'CAD for woodworkers',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${poppins.variable} ${rubik.variable} antialiased`}>
      <body className="font-sans">
        {children}
      </body>
    </html>
  );
}
