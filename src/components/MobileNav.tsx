import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Menu, TrendingUp, FileText, Shield } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';

interface MobileNavProps {
  isAdmin?: boolean;
}

export const MobileNav = ({ isAdmin = false }: MobileNavProps) => {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useLanguage();

  const navItems = [
    { path: '/', label: t('nav.dashboard'), icon: TrendingUp },
    { path: '/reports', label: t('nav.reports'), icon: FileText },
    ...(isAdmin ? [{ path: '/admin', label: t('nav.admin'), icon: Shield }] : []),
  ];

  const handleNavClick = (path: string) => {
    navigate(path);
    setOpen(false);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden">
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-64">
        <div className="flex flex-col gap-4 mt-8">
          <h2 className="text-lg font-semibold px-2">FinanceTrack</h2>
          <nav className="flex flex-col gap-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Button
                  key={item.path}
                  variant={isActive ? "default" : "ghost"}
                  className={cn(
                    "justify-start gap-2 transition-smooth",
                    isActive && "bg-primary text-primary-foreground"
                  )}
                  onClick={() => handleNavClick(item.path)}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Button>
              );
            })}
          </nav>
        </div>
      </SheetContent>
    </Sheet>
  );
};