import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FileSpreadsheet, FileText, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import jsPDF from 'jspdf';

interface CallStats {
  total_calls: number;
  total_duration_seconds: number;
  avg_duration_seconds: number;
  calls_last_week: number;
  calls_last_month: number;
}

interface TopContact {
  target_username: string;
  target_user_id: string | null;
  call_count: number;
  last_called_at: string;
}

interface CallStatsExportProps {
  stats: CallStats | null;
  topContacts: TopContact[];
}

const CallStatsExport = ({ stats, topContacts }: CallStatsExportProps) => {
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${Math.round(seconds)} сек`;
    if (seconds < 3600) return `${Math.round(seconds / 60)} мин`;
    const hours = Math.floor(seconds / 3600);
    const mins = Math.round((seconds % 3600) / 60);
    return `${hours}ч ${mins}м`;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const exportToPDF = async () => {
    if (!stats) return;
    setExportingPdf(true);

    try {
      const pdf = new jsPDF();
      const pageWidth = pdf.internal.pageSize.getWidth();
      
      // Title
      pdf.setFontSize(20);
      pdf.setTextColor(139, 92, 246); // Primary purple
      pdf.text('AP LINK - Статистика звонков', pageWidth / 2, 20, { align: 'center' });
      
      // Date
      pdf.setFontSize(10);
      pdf.setTextColor(100);
      pdf.text(`Отчёт от ${new Date().toLocaleDateString('ru-RU')}`, pageWidth / 2, 28, { align: 'center' });

      // Stats section
      pdf.setFontSize(14);
      pdf.setTextColor(0);
      let y = 45;

      pdf.text('Общая статистика', 20, y);
      y += 10;

      pdf.setFontSize(11);
      pdf.setTextColor(60);
      
      const statsData = [
        ['Всего звонков:', stats.total_calls.toString()],
        ['Общее время:', formatDuration(stats.total_duration_seconds)],
        ['Средняя длительность:', formatDuration(stats.avg_duration_seconds)],
        ['Звонков за неделю:', stats.calls_last_week.toString()],
        ['Звонков за месяц:', stats.calls_last_month.toString()],
      ];

      statsData.forEach(([label, value]) => {
        pdf.text(label, 25, y);
        pdf.setTextColor(0);
        pdf.text(value, 90, y);
        pdf.setTextColor(60);
        y += 8;
      });

      // Top contacts section
      if (topContacts.length > 0) {
        y += 10;
        pdf.setFontSize(14);
        pdf.setTextColor(0);
        pdf.text('Частые контакты', 20, y);
        y += 10;

        pdf.setFontSize(10);
        pdf.setTextColor(100);
        pdf.text('Контакт', 25, y);
        pdf.text('Звонков', 90, y);
        pdf.text('Последний', 130, y);
        y += 6;

        pdf.setDrawColor(200);
        pdf.line(20, y, 190, y);
        y += 5;

        pdf.setFontSize(11);
        topContacts.forEach((contact, index) => {
          pdf.setTextColor(139, 92, 246);
          pdf.text(`${index + 1}. @${contact.target_username}`, 25, y);
          pdf.setTextColor(0);
          pdf.text(contact.call_count.toString(), 95, y);
          pdf.setTextColor(100);
          pdf.text(formatDate(contact.last_called_at), 130, y);
          y += 8;
        });
      }

      // Draw chart visualization
      y += 15;
      pdf.setFontSize(14);
      pdf.setTextColor(0);
      pdf.text('Активность', 20, y);
      y += 10;

      // Simple bar chart
      const maxWidth = 100;
      const barHeight = 12;
      const maxCalls = Math.max(stats.calls_last_week, stats.calls_last_month, 1);

      pdf.setFillColor(139, 92, 246);
      const weekWidth = (stats.calls_last_week / maxCalls) * maxWidth;
      pdf.roundedRect(60, y, Math.max(weekWidth, 2), barHeight, 2, 2, 'F');
      pdf.setTextColor(60);
      pdf.text('Неделя', 25, y + 9);
      pdf.setTextColor(0);
      pdf.text(stats.calls_last_week.toString(), 165, y + 9);
      y += 18;

      pdf.setFillColor(59, 130, 246);
      const monthWidth = (stats.calls_last_month / maxCalls) * maxWidth;
      pdf.roundedRect(60, y, Math.max(monthWidth, 2), barHeight, 2, 2, 'F');
      pdf.setTextColor(60);
      pdf.text('Месяц', 25, y + 9);
      pdf.setTextColor(0);
      pdf.text(stats.calls_last_month.toString(), 165, y + 9);

      // Footer
      pdf.setFontSize(8);
      pdf.setTextColor(150);
      pdf.text('APOLLO PRODUCTION © AP LINK', pageWidth / 2, 285, { align: 'center' });

      pdf.save(`call-statistics-${new Date().toISOString().slice(0, 10)}.pdf`);
      toast.success('PDF экспортирован');
    } catch (error) {
      console.error('PDF export error:', error);
      toast.error('Ошибка экспорта PDF');
    } finally {
      setExportingPdf(false);
    }
  };

  const exportToExcel = async () => {
    if (!stats) return;
    setExportingExcel(true);

    try {
      // Create CSV content
      let csv = 'AP LINK - Статистика звонков\n';
      csv += `Дата отчёта:,${new Date().toLocaleDateString('ru-RU')}\n\n`;
      
      csv += 'ОБЩАЯ СТАТИСТИКА\n';
      csv += `Всего звонков,${stats.total_calls}\n`;
      csv += `Общее время (сек),${stats.total_duration_seconds}\n`;
      csv += `Общее время,${formatDuration(stats.total_duration_seconds)}\n`;
      csv += `Средняя длительность (сек),${stats.avg_duration_seconds}\n`;
      csv += `Средняя длительность,${formatDuration(stats.avg_duration_seconds)}\n`;
      csv += `Звонков за неделю,${stats.calls_last_week}\n`;
      csv += `Звонков за месяц,${stats.calls_last_month}\n\n`;

      if (topContacts.length > 0) {
        csv += 'ЧАСТЫЕ КОНТАКТЫ\n';
        csv += 'Контакт,Количество звонков,Последний звонок\n';
        topContacts.forEach((contact) => {
          csv += `@${contact.target_username},${contact.call_count},${formatDate(contact.last_called_at)}\n`;
        });
      }

      // Download as CSV
      const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `call-statistics-${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(url);

      toast.success('Excel экспортирован');
    } catch (error) {
      console.error('Excel export error:', error);
      toast.error('Ошибка экспорта Excel');
    } finally {
      setExportingExcel(false);
    }
  };

  return (
    <div className="flex gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={exportToPDF}
        disabled={!stats || exportingPdf}
      >
        {exportingPdf ? (
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
        ) : (
          <FileText className="w-4 h-4 mr-2" />
        )}
        PDF
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={exportToExcel}
        disabled={!stats || exportingExcel}
      >
        {exportingExcel ? (
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
        ) : (
          <FileSpreadsheet className="w-4 h-4 mr-2" />
        )}
        Excel
      </Button>
    </div>
  );
};

export default CallStatsExport;
