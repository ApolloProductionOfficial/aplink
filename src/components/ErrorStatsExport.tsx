import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";

interface ErrorLog {
  id: string;
  created_at: string;
  error_type: string;
  error_message: string;
  source: string | null;
  severity: string;
  details: Record<string, unknown> | null;
  url: string | null;
  user_agent: string | null;
  notified: boolean;
}

interface ErrorStats {
  total: number;
  byType: { type: string; count: number }[];
  bySeverity: { severity: string; count: number }[];
  today: number;
  week: number;
  notified: number;
}

interface ErrorStatsExportProps {
  errorLogs: ErrorLog[];
  errorStats: ErrorStats | null;
}

const ErrorStatsExport = ({ errorLogs, errorStats }: ErrorStatsExportProps) => {
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);

  const exportToCSV = async () => {
    setExportingExcel(true);
    try {
      // Create CSV content
      const headers = [
        "ID",
        "Дата",
        "Тип ошибки",
        "Сообщение",
        "Источник",
        "Критичность",
        "URL",
        "Отправлено"
      ];
      
      const rows = errorLogs.map(log => [
        log.id,
        new Date(log.created_at).toLocaleString("ru-RU"),
        log.error_type,
        `"${(log.error_message || "").replace(/"/g, '""')}"`,
        log.source || "",
        log.severity,
        log.url || "",
        log.notified ? "Да" : "Нет"
      ]);

      // Add summary at the top
      const summaryRows = [
        ["=== СТАТИСТИКА ОШИБОК APLink ==="],
        [`Дата отчёта: ${new Date().toLocaleString("ru-RU")}`],
        [""],
        ["ОБЩАЯ СТАТИСТИКА"],
        [`Всего ошибок: ${errorStats?.total || 0}`],
        [`Ошибок сегодня: ${errorStats?.today || 0}`],
        [`Ошибок за неделю: ${errorStats?.week || 0}`],
        [`Отправлено уведомлений: ${errorStats?.notified || 0}`],
        [""],
        ["ПО КРИТИЧНОСТИ"],
        ...(errorStats?.bySeverity.map(s => [`${s.severity}: ${s.count}`]) || []),
        [""],
        ["ПО ТИПУ ОШИБКИ (топ-10)"],
        ...(errorStats?.byType.slice(0, 10).map(t => [`${t.type}: ${t.count}`]) || []),
        [""],
        ["=== ДЕТАЛЬНЫЙ СПИСОК ОШИБОК ==="],
        [""]
      ];

      const csvContent = [
        ...summaryRows.map(row => row.join(",")),
        headers.join(","),
        ...rows.map(row => row.join(","))
      ].join("\n");

      // Add BOM for Excel to recognize UTF-8
      const BOM = "\uFEFF";
      const blob = new Blob([BOM + csvContent], { type: "text/csv;charset=utf-8;" });
      
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `aplink-errors-${new Date().toISOString().split("T")[0]}.csv`;
      link.click();
      
      toast.success("📊 Отчёт экспортирован в CSV");
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Ошибка экспорта");
    } finally {
      setExportingExcel(false);
    }
  };

  const exportToPDF = async () => {
    setExportingPdf(true);
    try {
      const pdf = new jsPDF();
      const pageWidth = pdf.internal.pageSize.getWidth();
      let yPos = 20;

      // Title
      pdf.setFontSize(20);
      pdf.setTextColor(0, 100, 200);
      pdf.text("APLink - Отчёт об ошибках", pageWidth / 2, yPos, { align: "center" });
      yPos += 10;

      // Date
      pdf.setFontSize(10);
      pdf.setTextColor(100, 100, 100);
      pdf.text(`Дата отчёта: ${new Date().toLocaleString("ru-RU")}`, pageWidth / 2, yPos, { align: "center" });
      yPos += 15;

      // Summary section
      pdf.setFontSize(14);
      pdf.setTextColor(0, 0, 0);
      pdf.text("Общая статистика", 20, yPos);
      yPos += 8;

      pdf.setFontSize(11);
      const statsData = [
        `Всего ошибок: ${errorStats?.total || 0}`,
        `Ошибок сегодня: ${errorStats?.today || 0}`,
        `Ошибок за неделю: ${errorStats?.week || 0}`,
        `Отправлено уведомлений: ${errorStats?.notified || 0}`
      ];

      statsData.forEach(line => {
        pdf.text(line, 25, yPos);
        yPos += 6;
      });
      yPos += 8;

      // By severity
      pdf.setFontSize(14);
      pdf.text("По критичности", 20, yPos);
      yPos += 8;

      pdf.setFontSize(11);
      (errorStats?.bySeverity || []).forEach(item => {
        const color = item.severity === "critical" ? [200, 0, 0] :
                     item.severity === "error" ? [200, 100, 0] :
                     item.severity === "warning" ? [200, 150, 0] : [0, 100, 200];
        pdf.setTextColor(color[0], color[1], color[2]);
        pdf.text(`${item.severity}: ${item.count}`, 25, yPos);
        yPos += 6;
      });
      yPos += 8;

      // By type (top 10)
      pdf.setTextColor(0, 0, 0);
      pdf.setFontSize(14);
      pdf.text("Топ-10 типов ошибок", 20, yPos);
      yPos += 8;

      pdf.setFontSize(10);
      (errorStats?.byType.slice(0, 10) || []).forEach(item => {
        const text = `${item.type}: ${item.count}`;
        if (yPos > 270) {
          pdf.addPage();
          yPos = 20;
        }
        pdf.text(text, 25, yPos);
        yPos += 5;
      });
      yPos += 10;

      // Recent errors
      pdf.addPage();
      yPos = 20;
      pdf.setFontSize(14);
      pdf.text("Последние ошибки (первые 30)", 20, yPos);
      yPos += 10;

      pdf.setFontSize(9);
      errorLogs.slice(0, 30).forEach((log, i) => {
        if (yPos > 270) {
          pdf.addPage();
          yPos = 20;
        }
        
        // Severity color
        const sevColor = log.severity === "critical" ? [200, 0, 0] :
                        log.severity === "error" ? [200, 100, 0] :
                        log.severity === "warning" ? [200, 150, 0] : [0, 100, 200];
        
        pdf.setTextColor(sevColor[0], sevColor[1], sevColor[2]);
        pdf.text(`[${log.severity.toUpperCase()}]`, 20, yPos);
        
        pdf.setTextColor(0, 0, 0);
        const dateStr = new Date(log.created_at).toLocaleString("ru-RU");
        pdf.text(dateStr, 45, yPos);
        
        pdf.setTextColor(50, 50, 50);
        const msgText = log.error_message.substring(0, 60) + (log.error_message.length > 60 ? "..." : "");
        pdf.text(msgText, 20, yPos + 5);
        
        yPos += 12;
      });

      // Save
      pdf.save(`aplink-errors-${new Date().toISOString().split("T")[0]}.pdf`);
      toast.success("📄 PDF отчёт создан");
    } catch (error) {
      console.error("PDF export error:", error);
      toast.error("Ошибка создания PDF");
    } finally {
      setExportingPdf(false);
    }
  };

  return (
    <div className="flex gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={exportToPDF}
        disabled={exportingPdf || !errorStats}
        className="gap-2"
      >
        {exportingPdf ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <FileText className="w-4 h-4" />
        )}
        PDF
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={exportToCSV}
        disabled={exportingExcel || !errorStats}
        className="gap-2"
      >
        {exportingExcel ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <FileSpreadsheet className="w-4 h-4" />
        )}
        Excel/CSV
      </Button>
    </div>
  );
};

export default ErrorStatsExport;
