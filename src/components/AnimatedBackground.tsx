const AnimatedBackground = () => {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden">
      {/* Animated gradient orbs */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-3xl animate-float" 
           style={{ animationDelay: '0s' }} />
      <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-accent/15 rounded-full blur-3xl animate-float" 
           style={{ animationDelay: '2s' }} />
      <div className="absolute bottom-1/4 left-1/3 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-float" 
           style={{ animationDelay: '4s' }} />
      
      {/* Grid pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:100px_100px]" />
      
      {/* Animated lines */}
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary/50 to-transparent animate-gradient" />
      <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary/50 to-transparent animate-gradient" 
           style={{ animationDelay: '4s' }} />
    </div>
  );
};

export default AnimatedBackground;
