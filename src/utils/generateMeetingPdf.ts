import jsPDF from 'jspdf';

interface MeetingData {
  room_name: string;
  started_at: string;
  ended_at: string | null;
  summary: string | null;
  transcript: string | null;
  participants: string[] | null;
  key_points: {
    summary?: string;
    keyPoints?: string[];
    actionItems?: string[];
    decisions?: string[];
  } | null;
}

export function generateMeetingPdf(meeting: MeetingData): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  // Helper function to add new page if needed
  const checkPageBreak = (requiredHeight: number) => {
    if (y + requiredHeight > pageHeight - margin) {
      doc.addPage();
      y = margin;
      return true;
    }
    return false;
  };

  // Helper to wrap text
  const addWrappedText = (text: string, fontSize: number, lineHeight: number = 1.4) => {
    doc.setFontSize(fontSize);
    const lines = doc.splitTextToSize(text, contentWidth);
    const textHeight = lines.length * fontSize * 0.35 * lineHeight;
    checkPageBreak(textHeight);
    doc.text(lines, margin, y);
    y += textHeight;
    return textHeight;
  };

  // Format date
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Calculate duration
  const getDuration = () => {
    if (!meeting.ended_at) return 'В процессе';
    const start = new Date(meeting.started_at).getTime();
    const end = new Date(meeting.ended_at).getTime();
    const diffMs = end - start;
    const mins = Math.floor(diffMs / 60000);
    const hours = Math.floor(mins / 60);
    const remainMins = mins % 60;
    if (hours > 0) {
      return `${hours} ч ${remainMins} мин`;
    }
    return `${mins} мин`;
  };

  // ========== HEADER ==========
  // Gradient-like header background
  doc.setFillColor(99, 102, 241); // Indigo/primary color
  doc.rect(0, 0, pageWidth, 45, 'F');

  // Title
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(24);
  doc.text('Конспект созвона', margin, 20);

  // Meeting name
  doc.setFontSize(14);
  doc.setFont('helvetica', 'normal');
  const truncatedName = meeting.room_name.length > 50 
    ? meeting.room_name.substring(0, 47) + '...' 
    : meeting.room_name;
  doc.text(truncatedName, margin, 32);

  // Logo/branding
  doc.setFontSize(10);
  doc.text('APLink by Apollo Production', pageWidth - margin - 60, 20);
  
  y = 55;

  // ========== META INFO ==========
  doc.setTextColor(100, 100, 100);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');

  // Date & Duration row
  const startDate = formatDate(meeting.started_at);
  const duration = getDuration();
  doc.text(`📅 ${startDate}`, margin, y);
  doc.text(`⏱ Длительность: ${duration}`, margin + 80, y);
  y += 8;

  // Participants
  if (meeting.participants && meeting.participants.length > 0) {
    doc.text(`👥 Участники: ${meeting.participants.join(', ')}`, margin, y);
    y += 10;
  }

  // Divider line
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);
  y += 10;

  // ========== SUMMARY ==========
  if (meeting.summary) {
    doc.setTextColor(50, 50, 50);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('📝 Краткое содержание', margin, y);
    y += 8;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(80, 80, 80);
    addWrappedText(meeting.summary, 11);
    y += 8;
  }

  // ========== KEY POINTS ==========
  if (meeting.key_points?.keyPoints && meeting.key_points.keyPoints.length > 0) {
    checkPageBreak(20);
    doc.setTextColor(50, 50, 50);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('🎯 Ключевые моменты', margin, y);
    y += 8;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(80, 80, 80);

    meeting.key_points.keyPoints.forEach((point, index) => {
      checkPageBreak(10);
      const bulletText = `${index + 1}. ${point}`;
      const lines = doc.splitTextToSize(bulletText, contentWidth - 5);
      doc.text(lines, margin + 3, y);
      y += lines.length * 5 + 2;
    });
    y += 5;
  }

  // ========== ACTION ITEMS ==========
  if (meeting.key_points?.actionItems && meeting.key_points.actionItems.length > 0) {
    checkPageBreak(20);
    doc.setTextColor(50, 50, 50);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('✅ Задачи к выполнению', margin, y);
    y += 8;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(80, 80, 80);

    meeting.key_points.actionItems.forEach((item) => {
      checkPageBreak(10);
      const bulletText = `☐ ${item}`;
      const lines = doc.splitTextToSize(bulletText, contentWidth - 5);
      doc.text(lines, margin + 3, y);
      y += lines.length * 5 + 2;
    });
    y += 5;
  }

  // ========== DECISIONS ==========
  if (meeting.key_points?.decisions && meeting.key_points.decisions.length > 0) {
    checkPageBreak(20);
    doc.setTextColor(50, 50, 50);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('💡 Принятые решения', margin, y);
    y += 8;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(80, 80, 80);

    meeting.key_points.decisions.forEach((decision, index) => {
      checkPageBreak(10);
      const bulletText = `${index + 1}. ${decision}`;
      const lines = doc.splitTextToSize(bulletText, contentWidth - 5);
      doc.text(lines, margin + 3, y);
      y += lines.length * 5 + 2;
    });
    y += 5;
  }

  // ========== FULL TRANSCRIPT ==========
  if (meeting.transcript) {
    checkPageBreak(25);
    
    // Section header
    doc.setFillColor(245, 245, 245);
    doc.rect(margin, y - 3, contentWidth, 10, 'F');
    
    doc.setTextColor(50, 50, 50);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('📄 Полная транскрипция', margin + 2, y + 4);
    y += 15;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);

    // Split transcript into manageable chunks
    const transcriptLines = doc.splitTextToSize(meeting.transcript, contentWidth);
    
    transcriptLines.forEach((line: string) => {
      if (checkPageBreak(6)) {
        // Add header on new page
        doc.setFontSize(9);
        doc.setTextColor(150, 150, 150);
        doc.text('(продолжение транскрипции)', margin, y);
        y += 6;
        doc.setTextColor(100, 100, 100);
      }
      doc.text(line, margin, y);
      y += 4;
    });
  }

  // ========== FOOTER on each page ==========
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `Сгенерировано APLink • ${new Date().toLocaleDateString('ru-RU')} • Страница ${i} из ${totalPages}`,
      margin,
      pageHeight - 10
    );
  }

  // Generate filename
  const dateStr = new Date(meeting.started_at).toLocaleDateString('ru-RU').replace(/\./g, '-');
  const safeName = meeting.room_name
    .replace(/[^a-zA-Zа-яА-Я0-9\s]/g, '')
    .replace(/\s+/g, '_')
    .substring(0, 30);
  const filename = `Созвон_${safeName}_${dateStr}.pdf`;

  // Download
  doc.save(filename);
}
