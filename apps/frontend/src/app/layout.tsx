import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { cookies } from 'next/headers';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { Providers } from '@/components/providers';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    template: '%s | iTour Car Rental',
    default: 'iTour Car Rental',
  },
  description: 'Car rental management dashboard',
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const locale = cookieStore.get('NEXT_LOCALE')?.value ?? 'en';
  const safeLocale = ['en', 'ar'].includes(locale) ? locale : 'en';
  const dir = safeLocale === 'ar' ? 'rtl' : 'ltr';

  const messages = await getMessages();

  return (
    <html lang={safeLocale} dir={dir} suppressHydrationWarning>
      <head />
      <body className={`${inter.variable} antialiased`}>
        <NextIntlClientProvider locale={safeLocale} messages={messages}>
          <Providers>{children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
