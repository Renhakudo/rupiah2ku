import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { Languages } from "lucide-react";

export const LanguageToggle = () => {
  const { language, setLanguage } = useLanguage();

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={() => setLanguage(language === 'en' ? 'id' : 'en')}
      title={language === 'en' ? 'Bahasa Indonesia' : 'English'}
      className="transition-smooth"
    >
      <Languages className="h-[1.2rem] w-[1.2rem]" />
      <span className="sr-only">{language.toUpperCase()}</span>
    </Button>
  );
};