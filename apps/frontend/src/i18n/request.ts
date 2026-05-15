import { getRequestConfig } from 'next-intl/server';
import { cookies } from 'next/headers';

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const locale = cookieStore.get('NEXT_LOCALE')?.value ?? 'en';
  const safeLocale = ['en', 'ar'].includes(locale) ? locale : 'en';

  return {
    locale: safeLocale,
    messages: (await import(`./locales/${safeLocale}.json`)).default,
  };
});
