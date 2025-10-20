import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useLanguage } from '@/contexts/LanguageContext';
import { Calendar } from 'lucide-react';

interface DateRangeFilterProps {
  startDate: string;
  endDate: string;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
  onQuickFilter: (days: number) => void;
}

export const DateRangeFilter = ({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  onQuickFilter,
}: DateRangeFilterProps) => {
  const { t } = useLanguage();

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Calendar className="w-4 h-4 text-muted-foreground" />
        <Label className="text-sm font-medium">{t('filter.dateRange')}</Label>
      </div>
      
      {/* Quick Filter Buttons */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onQuickFilter(7)}
          className="transition-smooth"
        >
          {t('filter.last7days')}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onQuickFilter(40)}
          className="transition-smooth"
        >
          {t('filter.last40days')}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onQuickFilter(60)}
          className="transition-smooth"
        >
          {t('filter.last60days')}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onQuickFilter(90)}
          className="transition-smooth"
        >
          {t('filter.last90days')}
        </Button>
      </div>

      {/* Custom Date Range */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="start-date">{t('reports.startDate')}</Label>
          <Input
            id="start-date"
            type="date"
            value={startDate}
            onChange={(e) => onStartDateChange(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="end-date">{t('reports.endDate')}</Label>
          <Input
            id="end-date"
            type="date"
            value={endDate}
            onChange={(e) => onEndDateChange(e.target.value)}
          />
        </div>
      </div>
    </div>
  );
};
