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
      position="top-center"
      offset="40vh"
      swipeDirections={["top"]}
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-white/[0.08] group-[.toaster]:backdrop-blur-2xl group-[.toaster]:text-foreground group-[.toaster]:border-white/[0.1] group-[.toaster]:shadow-[0_8px_32px_rgba(0,0,0,0.3)] group-[.toaster]:rounded-xl select-none cursor-pointer",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-primary/20 group-[.toast]:text-primary-foreground group-[.toast]:backdrop-blur-xl group-[.toast]:border-primary/30",
          cancelButton: "group-[.toast]:bg-white/[0.05] group-[.toast]:text-muted-foreground group-[.toast]:backdrop-blur-xl group-[.toast]:border-white/[0.1]",
          closeButton: "group-[.toast]:bg-white/[0.05] group-[.toast]:text-foreground group-[.toast]:border-white/[0.1] group-[.toast]:hover:bg-white/[0.1]",
        },
        style: {
          background: 'rgba(255, 255, 255, 0.08)',
          backdropFilter: 'blur(40px)',
          WebkitBackdropFilter: 'blur(40px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
