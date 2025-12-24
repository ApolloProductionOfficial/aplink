import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  BorderStyle,
  Header,
  Footer,
  PageNumber,
  NumberFormat,
} from 'docx';
import { saveAs } from 'file-saver';

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

// Format date helper
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
const getDuration = (startedAt: string, endedAt: string | null) => {
  if (!endedAt) return 'В процессе';
  const start = new Date(startedAt).getTime();
  const end = new Date(endedAt).getTime();
  const diffMs = end - start;
  const mins = Math.floor(diffMs / 60000);
  const hours = Math.floor(mins / 60);
  const remainMins = mins % 60;
  if (hours > 0) {
    return `${hours} ч ${remainMins} мин`;
  }
  return `${mins} мин`;
};

export async function generateMeetingDocx(meeting: MeetingData): Promise<void> {
  const sections = [];

  // Title
  sections.push(
    new Paragraph({
      children: [
        new TextRun({
          text: 'Конспект созвона',
          bold: true,
          size: 48,
          color: '6366F1',
        }),
      ],
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
    })
  );

  // Meeting name
  sections.push(
    new Paragraph({
      children: [
        new TextRun({
          text: meeting.room_name,
          bold: true,
          size: 32,
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
    })
  );

  // Meta info
  const startDate = formatDate(meeting.started_at);
  const duration = getDuration(meeting.started_at, meeting.ended_at);

  sections.push(
    new Paragraph({
      children: [
        new TextRun({ text: 'Дата: ', bold: true, size: 22 }),
        new TextRun({ text: startDate, size: 22 }),
        new TextRun({ text: '    |    ', size: 22, color: '999999' }),
        new TextRun({ text: 'Длительность: ', bold: true, size: 22 }),
        new TextRun({ text: duration, size: 22 }),
      ],
      spacing: { after: 100 },
    })
  );

  // Participants
  if (meeting.participants && meeting.participants.length > 0) {
    sections.push(
      new Paragraph({
        children: [
          new TextRun({ text: 'Участники: ', bold: true, size: 22 }),
          new TextRun({ text: meeting.participants.join(', '), size: 22 }),
        ],
        spacing: { after: 300 },
      })
    );
  }

  // Divider
  sections.push(
    new Paragraph({
      children: [],
      border: {
        bottom: { style: BorderStyle.SINGLE, size: 6, color: 'CCCCCC' },
      },
      spacing: { after: 300 },
    })
  );

  // Summary
  if (meeting.summary) {
    sections.push(
      new Paragraph({
        children: [
          new TextRun({
            text: 'Краткое содержание',
            bold: true,
            size: 28,
            color: '333333',
          }),
        ],
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 200, after: 100 },
      })
    );

    sections.push(
      new Paragraph({
        children: [new TextRun({ text: meeting.summary, size: 22 })],
        spacing: { after: 300 },
      })
    );
  }

  // Key Points
  if (meeting.key_points?.keyPoints && meeting.key_points.keyPoints.length > 0) {
    sections.push(
      new Paragraph({
        children: [
          new TextRun({
            text: 'Ключевые моменты',
            bold: true,
            size: 28,
            color: '333333',
          }),
        ],
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 200, after: 100 },
      })
    );

    meeting.key_points.keyPoints.forEach((point, idx) => {
      sections.push(
        new Paragraph({
          children: [
            new TextRun({ text: `${idx + 1}. `, bold: true, size: 22 }),
            new TextRun({ text: point, size: 22 }),
          ],
          spacing: { after: 80 },
        })
      );
    });
  }

  // Action Items
  if (meeting.key_points?.actionItems && meeting.key_points.actionItems.length > 0) {
    sections.push(
      new Paragraph({
        children: [
          new TextRun({
            text: 'Задачи к выполнению',
            bold: true,
            size: 28,
            color: '333333',
          }),
        ],
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 200, after: 100 },
      })
    );

    meeting.key_points.actionItems.forEach((item) => {
      sections.push(
        new Paragraph({
          children: [
            new TextRun({ text: '☐ ', size: 22 }),
            new TextRun({ text: item, size: 22 }),
          ],
          spacing: { after: 80 },
        })
      );
    });
  }

  // Decisions
  if (meeting.key_points?.decisions && meeting.key_points.decisions.length > 0) {
    sections.push(
      new Paragraph({
        children: [
          new TextRun({
            text: 'Принятые решения',
            bold: true,
            size: 28,
            color: '333333',
          }),
        ],
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 200, after: 100 },
      })
    );

    meeting.key_points.decisions.forEach((decision, idx) => {
      sections.push(
        new Paragraph({
          children: [
            new TextRun({ text: `${idx + 1}. `, bold: true, size: 22 }),
            new TextRun({ text: decision, size: 22 }),
          ],
          spacing: { after: 80 },
        })
      );
    });
  }

  // Transcript
  if (meeting.transcript) {
    sections.push(
      new Paragraph({
        children: [
          new TextRun({
            text: 'Полная транскрипция',
            bold: true,
            size: 28,
            color: '333333',
          }),
        ],
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 300, after: 100 },
      })
    );

    // Split transcript into paragraphs
    const transcriptLines = meeting.transcript.split('\n').filter((line) => line.trim());
    transcriptLines.forEach((line) => {
      sections.push(
        new Paragraph({
          children: [new TextRun({ text: line, size: 20, color: '666666' })],
          spacing: { after: 60 },
        })
      );
    });
  }

  // Create document
  const doc = new Document({
    sections: [
      {
        properties: {},
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: 'APLink by Apollo Production',
                    size: 18,
                    color: '999999',
                    italics: true,
                  }),
                ],
                alignment: AlignmentType.RIGHT,
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: `Сгенерировано APLink • ${new Date().toLocaleDateString('ru-RU')} • Страница `,
                    size: 16,
                    color: '999999',
                  }),
                  new TextRun({
                    children: [PageNumber.CURRENT],
                    size: 16,
                    color: '999999',
                  }),
                  new TextRun({
                    text: ' из ',
                    size: 16,
                    color: '999999',
                  }),
                  new TextRun({
                    children: [PageNumber.TOTAL_PAGES],
                    size: 16,
                    color: '999999',
                  }),
                ],
                alignment: AlignmentType.CENTER,
              }),
            ],
          }),
        },
        children: sections,
      },
    ],
  });

  // Generate filename
  const dateStr = new Date(meeting.started_at).toLocaleDateString('ru-RU').replace(/\./g, '-');
  const safeName = meeting.room_name
    .replace(/[^a-zA-Zа-яА-Я0-9\s]/g, '')
    .replace(/\s+/g, '_')
    .substring(0, 30);
  const filename = `Созвон_${safeName}_${dateStr}.docx`;

  // Download
  const blob = await Packer.toBlob(doc);
  saveAs(blob, filename);
}
