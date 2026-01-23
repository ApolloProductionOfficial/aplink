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
      swipeDirections={["top"]}
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-black/60 group-[.toaster]:backdrop-blur-xl group-[.toaster]:text-foreground group-[.toaster]:border-white/10 group-[.toaster]:shadow-lg select-none",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-primary/80 group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted/60 group-[.toast]:text-muted-foreground",
          closeButton: "group-[.toast]:bg-black/40 group-[.toast]:text-foreground group-[.toast]:border-white/10",
        },
        style: {
          background: 'rgba(0, 0, 0, 0.6)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
