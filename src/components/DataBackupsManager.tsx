import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Database, Download, Trash2, RotateCcw, Loader2, 
  HardDrive, Clock, FileJson, AlertCircle 
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

interface DataBackup {
  id: string;
  created_at: string;
  operation_type: string;
  table_name: string;
  records_count: number;
  backup_data: Record<string, unknown>;
  restored_at: string | null;
  expires_at: string;
}

interface BackupStats {
  total: number;
  byTable: Record<string, number>;
  totalSize: number;
}

const DataBackupsManager: React.FC = () => {
  const [backups, setBackups] = useState<DataBackup[]>([]);
  const [stats, setStats] = useState<BackupStats>({ total: 0, byTable: {}, totalSize: 0 });
  const [loading, setLoading] = useState(true);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    fetchBackups();
  }, []);

  const fetchBackups = async () => {
    try {
      const { data, error } = await supabase
        .from('data_backups')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      const backupData = (data || []) as DataBackup[];
      setBackups(backupData);

      // Calculate stats
      const byTable: Record<string, number> = {};
      let totalSize = 0;
      
      backupData.forEach(b => {
        byTable[b.table_name] = (byTable[b.table_name] || 0) + 1;
        totalSize += JSON.stringify(b.backup_data).length;
      });

      setStats({
        total: backupData.length,
        byTable,
        totalSize
      });
    } catch (error) {
      console.error('Error fetching backups:', error);
      toast.error('Ошибка загрузки бэкапов');
    } finally {
      setLoading(false);
    }
  };

  const restoreBackup = async (backup: DataBackup) => {
    setRestoring(backup.id);
    try {
      // Insert the backed up data back into the original table
      // We need to handle this based on the table type
      const tableName = backup.table_name;
      const backupDataArray = Array.isArray(backup.backup_data) ? backup.backup_data : [backup.backup_data];
      
      if (tableName === 'error_logs') {
        const { error } = await supabase.from('error_logs').insert(backupDataArray as any);
        if (error) throw error;
      } else if (tableName === 'meeting_participants') {
        const { error } = await supabase.from('meeting_participants').insert(backupDataArray as any);
        if (error) throw error;
      } else if (tableName === 'translation_history') {
        const { error } = await supabase.from('translation_history').insert(backupDataArray as any);
        if (error) throw error;
      } else {
        throw new Error(`Unknown table: ${tableName}`);
      }

      // Mark as restored
      await supabase
        .from('data_backups')
        .update({ restored_at: new Date().toISOString() })
        .eq('id', backup.id);

      toast.success('Данные восстановлены');
      fetchBackups();
    } catch (error) {
      console.error('Error restoring backup:', error);
      toast.error('Ошибка восстановления');
    } finally {
      setRestoring(null);
    }
  };

  const deleteBackup = async (id: string) => {
    setDeleting(id);
    try {
      const { error } = await supabase
        .from('data_backups')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success('Бэкап удалён');
      fetchBackups();
    } catch (error) {
      console.error('Error deleting backup:', error);
      toast.error('Ошибка удаления');
    } finally {
      setDeleting(null);
    }
  };

  const cleanupExpired = async () => {
    try {
      const { data, error } = await supabase.rpc('cleanup_expired_backups');
      if (error) throw error;
      toast.success(`Удалено ${data} просроченных бэкапов`);
      fetchBackups();
    } catch (error) {
      console.error('Error cleaning up:', error);
      toast.error('Ошибка очистки');
    }
  };

  const exportBackup = (backup: DataBackup) => {
    const blob = new Blob([JSON.stringify(backup.backup_data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup_${backup.table_name}_${format(new Date(backup.created_at), 'yyyy-MM-dd_HH-mm')}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Бэкап экспортирован');
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getOperationLabel = (type: string) => {
    const labels: Record<string, string> = {
      delete_error_logs: 'Удаление ошибок',
      delete_meeting_participants: 'Удаление участников',
      delete_translation_history: 'Удаление переводов',
      cleanup_errors: 'Очистка ошибок',
      diagnostics_fix: 'Авто-исправление'
    };
    return labels[type] || type;
  };

  const getTableBadgeColor = (table: string) => {
    const colors: Record<string, string> = {
      error_logs: 'bg-red-500/10 text-red-500 border-red-500/20',
      meeting_participants: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
      translation_history: 'bg-green-500/10 text-green-500 border-green-500/20'
    };
    return colors[table] || 'bg-muted text-muted-foreground';
  };

  if (loading) {
    return (
      <Card className="bg-card/50 border-border/50">
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card/50 border-border/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Database className="h-5 w-5 text-primary" />
            Резервные копии данных
          </CardTitle>
          <Button variant="outline" size="sm" onClick={cleanupExpired}>
            <Trash2 className="h-4 w-4 mr-1" />
            Очистить просроченные
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-muted/30 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold">{stats.total}</div>
            <div className="text-xs text-muted-foreground">Всего бэкапов</div>
          </div>
          <div className="bg-muted/30 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold">{formatSize(stats.totalSize)}</div>
            <div className="text-xs text-muted-foreground">Общий размер</div>
          </div>
          {Object.entries(stats.byTable).slice(0, 2).map(([table, count]) => (
            <div key={table} className="bg-muted/30 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold">{count}</div>
              <div className="text-xs text-muted-foreground truncate">{table}</div>
            </div>
          ))}
        </div>

        {/* Backup list */}
        {backups.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <HardDrive className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>Нет резервных копий</p>
            <p className="text-xs mt-1">Бэкапы создаются автоматически при удалении данных</p>
          </div>
        ) : (
          <ScrollArea className="h-[300px]">
            <div className="space-y-2">
              {backups.map((backup) => (
                <div
                  key={backup.id}
                  className="flex items-center justify-between p-3 bg-muted/20 rounded-lg border border-border/30"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <FileJson className="h-5 w-5 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm truncate">
                          {getOperationLabel(backup.operation_type)}
                        </span>
                        <Badge variant="outline" className={getTableBadgeColor(backup.table_name)}>
                          {backup.table_name}
                        </Badge>
                        {backup.restored_at && (
                          <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20">
                            Восстановлено
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                        <Clock className="h-3 w-3" />
                        {format(new Date(backup.created_at), 'dd MMM yyyy, HH:mm', { locale: ru })}
                        <span className="text-muted-foreground/50">•</span>
                        <span>{formatSize(JSON.stringify(backup.backup_data).length)}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => exportBackup(backup)}
                      title="Экспорт"
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    {!backup.restored_at && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => restoreBackup(backup)}
                        disabled={restoring === backup.id}
                        title="Восстановить"
                      >
                        {restoring === backup.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <RotateCcw className="h-4 w-4" />
                        )}
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => deleteBackup(backup.id)}
                      disabled={deleting === backup.id}
                      title="Удалить"
                    >
                      {deleting === backup.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}

        {/* Info */}
        <div className="flex items-start gap-2 p-3 bg-blue-500/10 rounded-lg border border-blue-500/20">
          <AlertCircle className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
          <div className="text-xs text-blue-500">
            Бэкапы создаются автоматически перед удалением записей из таблиц: error_logs, meeting_participants, translation_history.
            Срок хранения — 30 дней.
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default DataBackupsManager;