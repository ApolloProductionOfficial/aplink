import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, CheckCircle2, XCircle, RotateCcw } from "lucide-react";

export type MeetingSaveStatus = "saving" | "success" | "error";

interface MeetingEndSaveDialogProps {
  open: boolean;
  status: MeetingSaveStatus;
  errorMessage?: string | null;
  onRetry: () => void;
  onGoToCalls: () => void;
  onExitWithoutSaving: () => void;
}

export function MeetingEndSaveDialog({
  open,
  status,
  errorMessage,
  onRetry,
  onGoToCalls,
  onExitWithoutSaving,
}: MeetingEndSaveDialogProps) {
  const isSaving = status === "saving";
  const isSuccess = status === "success";
  const isError = status === "error";

  return (
    <Dialog open={open}>
      <DialogContent
        className="max-w-md"
        // не даём закрыть во время сохранения (нет ложных успехов)
        onEscapeKeyDown={(e) => {
          if (isSaving) e.preventDefault();
        }}
        onPointerDownOutside={(e) => {
          if (isSaving) e.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isSaving && <Loader2 className="h-5 w-5 animate-spin text-primary" />}
            {isSuccess && <CheckCircle2 className="h-5 w-5 text-primary" />}
            {isError && <XCircle className="h-5 w-5 text-destructive" />}
            {isSaving && "Сохраняем…"}
            {isSuccess && "Сохранено"}
            {isError && "Ошибка"}
          </DialogTitle>
          <DialogDescription>
            {isSaving && "Пожалуйста, не закрывайте вкладку — идёт сохранение созвона."}
            {isSuccess && "Созвон сохранён и доступен в разделе «Мои созвоны»."}
            {isError && (errorMessage || "Не удалось сохранить созвон. Попробуйте ещё раз.")}
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="gap-2 sm:gap-2">
          {isSaving ? (
            <Button variant="secondary" disabled className="w-full sm:w-auto">
              Идёт сохранение…
            </Button>
          ) : isSuccess ? (
            <Button onClick={onGoToCalls} className="w-full sm:w-auto">
              Перейти в «Мои созвоны»
            </Button>
          ) : (
            <>
              <Button onClick={onRetry} className="w-full sm:w-auto">
                <RotateCcw className="mr-2 h-4 w-4" />
                Повторить
              </Button>
              <Button variant="secondary" onClick={onExitWithoutSaving} className="w-full sm:w-auto">
                Выйти без сохранения
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
