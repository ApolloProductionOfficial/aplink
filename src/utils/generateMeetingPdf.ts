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

// Load font as base64
async function loadFontAsBase64(url: string): Promise<string> {
  const response = await fetch(url);
  const arrayBuffer = await response.arrayBuffer();
  const uint8Array = new Uint8Array(arrayBuffer);
  let binary = '';
  for (let i = 0; i < uint8Array.length; i++) {
    binary += String.fromCharCode(uint8Array[i]);
  }
  return btoa(binary);
}

// Load image as base64
async function loadImageAsBase64(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Cannot get canvas context'));
        return;
      }
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = reject;
    img.src = url;
  });
}

export async function generateMeetingPdf(meeting: MeetingData): Promise<void> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  // Load and set Roboto font for Cyrillic support
  try {
    const regularFontBase64 = await loadFontAsBase64('/fonts/Roboto-Regular.ttf');
    const boldFontBase64 = await loadFontAsBase64('/fonts/Roboto-Bold.ttf');
    
    doc.addFileToVFS('Roboto-Regular.ttf', regularFontBase64);
    doc.addFileToVFS('Roboto-Bold.ttf', boldFontBase64);
    doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');
    doc.addFont('Roboto-Bold.ttf', 'Roboto', 'bold');
    doc.setFont('Roboto');
  } catch (e) {
    console.error('Failed to load fonts:', e);
    // Fallback to helvetica if fonts fail to load
  }

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  // Load logo for watermark
  let logoBase64: string | null = null;
  try {
    logoBase64 = await loadImageAsBase64('/images/apollo-logo.png');
  } catch (e) {
    console.error('Failed to load logo:', e);
  }

  // Helper function to add watermark to current page
  const addWatermark = () => {
    if (logoBase64) {
      // Add semi-transparent logo as watermark in center
      const watermarkSize = 80;
      const centerX = (pageWidth - watermarkSize) / 2;
      const centerY = (pageHeight - watermarkSize) / 2;
      
      // Save current state
      const currentGState = doc.saveGraphicsState();
      
      // Set transparency
      doc.setGState(doc.GState({ opacity: 0.08 }));
      
      doc.addImage(logoBase64, 'PNG', centerX, centerY, watermarkSize, watermarkSize);
      
      // Restore state
      doc.restoreGraphicsState();
    }
    
    // Add text watermark
    doc.setFontSize(12);
    doc.setTextColor(200, 200, 200);
    doc.setFont('Roboto', 'bold');
    
    // Diagonal text watermark
    const watermarkText = 'APOLLO PRODUCTION';
    doc.text(watermarkText, pageWidth / 2, pageHeight / 2, {
      angle: 45,
      align: 'center',
    });
  };

  // Helper function to add new page if needed
  const checkPageBreak = (requiredHeight: number) => {
    if (y + requiredHeight > pageHeight - margin - 15) {
      doc.addPage();
      addWatermark();
      y = margin;
      return true;
    }
    return false;
  };

  // Helper to wrap text
  const addWrappedText = (text: string, fontSize: number, isBold = false, lineHeight: number = 1.4) => {
    doc.setFontSize(fontSize);
    doc.setFont('Roboto', isBold ? 'bold' : 'normal');
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

  // Add watermark to first page
  addWatermark();

  // ========== HEADER ==========
  // Gradient-like header background
  doc.setFillColor(99, 102, 241); // Indigo/primary color
  doc.rect(0, 0, pageWidth, 45, 'F');

  // Title
  doc.setTextColor(255, 255, 255);
  doc.setFont('Roboto', 'bold');
  doc.setFontSize(24);
  doc.text('Конспект созвона', margin, 20);

  // Meeting name
  doc.setFontSize(14);
  doc.setFont('Roboto', 'normal');
  const truncatedName = meeting.room_name.length > 50 
    ? meeting.room_name.substring(0, 47) + '...' 
    : meeting.room_name;
  doc.text(truncatedName, margin, 32);

  // Logo/branding
  doc.setFontSize(10);
  doc.text('APLink by Apollo Production', pageWidth - margin - 55, 20);
  
  y = 55;

  // ========== META INFO ==========
  doc.setTextColor(100, 100, 100);
  doc.setFontSize(10);
  doc.setFont('Roboto', 'normal');

  // Date & Duration row
  const startDate = formatDate(meeting.started_at);
  const duration = getDuration();
  doc.text(`Дата: ${startDate}`, margin, y);
  doc.text(`Длительность: ${duration}`, margin + 90, y);
  y += 8;

  // Participants
  if (meeting.participants && meeting.participants.length > 0) {
    doc.text(`Участники: ${meeting.participants.join(', ')}`, margin, y);
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
    doc.setFont('Roboto', 'bold');
    doc.setFontSize(14);
    doc.text('Краткое содержание', margin, y);
    y += 8;

    doc.setFont('Roboto', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(80, 80, 80);
    addWrappedText(meeting.summary, 11);
    y += 8;
  }

  // ========== KEY POINTS ==========
  if (meeting.key_points?.keyPoints && meeting.key_points.keyPoints.length > 0) {
    checkPageBreak(20);
    doc.setTextColor(50, 50, 50);
    doc.setFont('Roboto', 'bold');
    doc.setFontSize(14);
    doc.text('Ключевые моменты', margin, y);
    y += 8;

    doc.setFont('Roboto', 'normal');
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
    doc.setFont('Roboto', 'bold');
    doc.setFontSize(14);
    doc.text('Задачи к выполнению', margin, y);
    y += 8;

    doc.setFont('Roboto', 'normal');
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
    doc.setFont('Roboto', 'bold');
    doc.setFontSize(14);
    doc.text('Принятые решения', margin, y);
    y += 8;

    doc.setFont('Roboto', 'normal');
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
    doc.setFont('Roboto', 'bold');
    doc.setFontSize(14);
    doc.text('Полная транскрипция', margin + 2, y + 4);
    y += 15;

    doc.setFont('Roboto', 'normal');
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
    doc.setFont('Roboto', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `Сгенерировано APLink by Apollo Production • ${new Date().toLocaleDateString('ru-RU')} • Страница ${i} из ${totalPages}`,
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
