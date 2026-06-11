import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  locales: ['ja', 'en', 'zh', 'ko', 'es', 'fr', 'de', 'pt', 'vi', 'id'],
  defaultLocale: 'ja',
});
