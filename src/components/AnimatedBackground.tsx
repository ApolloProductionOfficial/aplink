import { useReducedMotion } from '@/hooks/useReducedMotion';

const AnimatedBackground = () => {
  const reduceMotion = useReducedMotion();

  return (
    <div className="fixed inset-0 -z-10 overflow-hidden bg-background">
      {/* Subtle gradient orbs - simplified on mobile */}
      <div
        className={`absolute top-0 left-1/4 w-96 h-96 bg-primary/3 rounded-full blur-3xl ${
          reduceMotion ? '' : 'animate-float'
        }`}
        style={{ animationDelay: "0s" }}
      />
      {!reduceMotion && (
        <>
          <div
            className="absolute top-1/3 right-1/4 w-96 h-96 bg-primary/2 rounded-full blur-3xl animate-float"
            style={{ animationDelay: "2s" }}
          />
          <div
            className="absolute bottom-1/4 left-1/3 w-96 h-96 bg-primary/3 rounded-full blur-3xl animate-float"
            style={{ animationDelay: "4s" }}
          />
        </>
      )}

      {/* Subtle grid pattern - always static */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.01)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.01)_1px,transparent_1px)] bg-[size:100px_100px]" />
    </div>
  );
};

export default AnimatedBackground;
