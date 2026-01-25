import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      duration={2000}
      closeButton={true}
      position="top-right"
      offset="16px"
      swipeDirections={["right"]}
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-black/60 group-[.toaster]:backdrop-blur-2xl group-[.toaster]:text-white group-[.toaster]:border-white/[0.1] group-[.toaster]:shadow-[0_8px_32px_rgba(0,0,0,0.6)] group-[.toaster]:rounded-xl select-none cursor-pointer",
          description: "group-[.toast]:text-white/70",
          actionButton: "group-[.toast]:bg-primary/20 group-[.toast]:text-primary-foreground group-[.toast]:backdrop-blur-xl group-[.toast]:border-primary/30",
          cancelButton: "group-[.toast]:bg-white/10 group-[.toast]:text-white group-[.toast]:backdrop-blur-xl group-[.toast]:border-white/[0.1]",
          closeButton: "group-[.toast]:bg-white/10 group-[.toast]:text-white group-[.toast]:border-white/[0.1] group-[.toast]:hover:bg-white/[0.15]",
          title: "group-[.toast]:text-white group-[.toast]:font-medium",
          success: "group-[.toaster]:!bg-emerald-500/20 group-[.toaster]:!border-emerald-500/30",
          error: "group-[.toaster]:!bg-red-500/20 group-[.toaster]:!border-red-500/30",
          info: "group-[.toaster]:!bg-cyan-500/20 group-[.toaster]:!border-cyan-500/30",
          warning: "group-[.toaster]:!bg-yellow-500/20 group-[.toaster]:!border-yellow-500/30",
        },
        style: {
          background: 'rgba(0, 0, 0, 0.6)',
          backdropFilter: 'blur(40px)',
          WebkitBackdropFilter: 'blur(40px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          color: '#ffffff',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
