import { useLanguage } from '@/contexts/LanguageContext';
import { translations } from '@/locales/translations';

export const useTranslation = () => {
  const { language } = useLanguage();
  
  return {
    t: translations[language],
    language
  };
};
