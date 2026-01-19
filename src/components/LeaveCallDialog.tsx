import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Phone, PhoneOff } from "lucide-react";

interface LeaveCallDialogProps {
  open: boolean;
  onStay: () => void;
  onLeave: () => void;
}

const LeaveCallDialog = ({ open, onStay, onLeave }: LeaveCallDialogProps) => {
  return (
    <AlertDialog open={open} onOpenChange={(isOpen) => !isOpen && onStay()}>
      <AlertDialogContent className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 border border-white/10 shadow-2xl max-w-md">
        <AlertDialogHeader>
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center animate-pulse">
              <PhoneOff className="w-8 h-8 text-red-400" />
            </div>
          </div>
          <AlertDialogTitle className="text-xl text-center text-white">
            Покинуть созвон?
          </AlertDialogTitle>
          <AlertDialogDescription className="text-center text-gray-300 mt-2">
            Вы уверены, что хотите покинуть созвон? Ваш вызов будет завершён, и вы покинете конференцию.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex gap-3 mt-6 sm:flex-row">
          <AlertDialogCancel 
            onClick={onStay}
            className="flex-1 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white border-0 gap-2"
          >
            <Phone className="w-4 h-4" />
            Остаться
          </AlertDialogCancel>
          <AlertDialogAction 
            onClick={onLeave}
            className="flex-1 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white gap-2"
          >
            <PhoneOff className="w-4 h-4" />
            Покинуть
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default LeaveCallDialog;
