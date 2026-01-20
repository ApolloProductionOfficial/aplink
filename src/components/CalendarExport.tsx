import { Button } from '@/components/ui/button';
import { Calendar as CalendarIcon, Download } from 'lucide-react';
import { toast } from 'sonner';

interface CalendarExportProps {
  roomName: string;
  scheduledAt: string;
  description?: string | null;
  participantCount?: number;
}

const CalendarExport = ({ roomName, scheduledAt, description, participantCount }: CalendarExportProps) => {
  const generateICSContent = () => {
    const startDate = new Date(scheduledAt);
    const endDate = new Date(startDate.getTime() + 60 * 60 * 1000); // 1 hour duration
    
    const formatICSDate = (date: Date) => {
      return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    };
    
    const uid = `${startDate.getTime()}-${roomName.replace(/\s/g, '')}-aplink`;
    
    const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//APLink//Call Scheduler//RU
CALSCALE:GREGORIAN
METHOD:PUBLISH
BEGIN:VEVENT
UID:${uid}
DTSTAMP:${formatICSDate(new Date())}
DTSTART:${formatICSDate(startDate)}
DTEND:${formatICSDate(endDate)}
SUMMARY:📞 ${roomName}
DESCRIPTION:${description || 'Запланированный звонок через APLink'}${participantCount ? `\\nУчастников: ${participantCount}` : ''}\\n\\nПрисоединиться: https://aplink.live/meeting?room=${encodeURIComponent(roomName)}
URL:https://aplink.live/meeting?room=${encodeURIComponent(roomName)}
STATUS:CONFIRMED
TRANSP:OPAQUE
BEGIN:VALARM
TRIGGER:-PT15M
ACTION:DISPLAY
DESCRIPTION:Звонок "${roomName}" начнётся через 15 минут
END:VALARM
BEGIN:VALARM
TRIGGER:-PT5M
ACTION:DISPLAY
DESCRIPTION:Звонок "${roomName}" начнётся через 5 минут
END:VALARM
END:VEVENT
END:VCALENDAR`;

    return icsContent;
  };

  const downloadICS = () => {
    const icsContent = generateICSContent();
    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${roomName.replace(/\s/g, '-')}.ics`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success('Файл календаря скачан. Откройте его для добавления в Google/Apple Calendar.');
  };

  const openGoogleCalendar = () => {
    const startDate = new Date(scheduledAt);
    const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);
    
    const formatGoogleDate = (date: Date) => {
      return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    };
    
    const googleUrl = new URL('https://calendar.google.com/calendar/render');
    googleUrl.searchParams.set('action', 'TEMPLATE');
    googleUrl.searchParams.set('text', `📞 ${roomName}`);
    googleUrl.searchParams.set('dates', `${formatGoogleDate(startDate)}/${formatGoogleDate(endDate)}`);
    googleUrl.searchParams.set('details', `${description || 'Запланированный звонок через APLink'}\n\nПрисоединиться: https://aplink.live/meeting?room=${encodeURIComponent(roomName)}`);
    googleUrl.searchParams.set('location', `https://aplink.live/meeting?room=${encodeURIComponent(roomName)}`);
    
    window.open(googleUrl.toString(), '_blank');
    toast.success('Открыто в Google Calendar');
  };

  return (
    <div className="flex gap-1">
      <Button
        size="sm"
        variant="ghost"
        onClick={openGoogleCalendar}
        className="h-8 px-2 text-xs gap-1"
        title="Добавить в Google Calendar"
      >
        <CalendarIcon className="w-3 h-3" />
        <span className="hidden sm:inline">Google</span>
      </Button>
      <Button
        size="sm"
        variant="ghost"
        onClick={downloadICS}
        className="h-8 px-2 text-xs gap-1"
        title="Скачать .ics файл"
      >
        <Download className="w-3 h-3" />
        <span className="hidden sm:inline">.ics</span>
      </Button>
    </div>
  );
};

export default CalendarExport;
