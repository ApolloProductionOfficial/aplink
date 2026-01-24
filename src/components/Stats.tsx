import { useEffect, useRef, useState } from "react";

const Stats = () => {
  const stats = [
    {
      value: 20000,
      prefix: "$",
      suffix: "+",
      label: "Средний доход модели",
    },
    {
      value: 5000,
      prefix: "$",
      suffix: "+",
      label: "Первый месяц",
    },
    {
      value: 100,
      prefix: "",
      suffix: "%",
      label: "ROI",
    },
  ];

  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold: 0.3 }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => {
      if (sectionRef.current) {
        observer.unobserve(sectionRef.current);
      }
    };
  }, []);

  return (
    <section id="stats" className="py-20 px-4" ref={sectionRef}>
      <div className="container mx-auto">
        <div className="grid md:grid-cols-3 gap-8">
          {stats.map((stat, index) => (
            <StatCard 
              key={index} 
              stat={stat} 
              isVisible={isVisible}
              delay={index * 0.2}
            />
          ))}
        </div>
      </div>
    </section>
  );
};

const StatCard = ({ 
  stat, 
  isVisible, 
  delay 
}: { 
  stat: { value: number; suffix: string; label: string; prefix?: string }; 
  isVisible: boolean;
  delay: number;
}) => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!isVisible) return;
    
    let startTime: number;
    const duration = 2000; // 2 seconds animation
    
    const animate = (currentTime: number) => {
      if (!startTime) startTime = currentTime;
      const progress = Math.min((currentTime - startTime) / duration, 1);
      
      // Easing function for smooth animation
      const easeOutQuart = 1 - Math.pow(1 - progress, 4);
      setCount(Math.floor(easeOutQuart * stat.value));
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    
    const timer = setTimeout(() => {
      requestAnimationFrame(animate);
    }, delay * 1000);

    return () => clearTimeout(timer);
  }, [isVisible, stat.value, delay]);

  return (
    <div
      className="relative glass rounded-2xl p-8 border border-primary/30 hover:border-primary/60 hover:shadow-2xl hover:shadow-primary/40 transition-all duration-500 group hover:scale-105 overflow-hidden"
      style={{ 
        animationDelay: `${delay}s`,
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? 'translateY(0)' : 'translateY(30px)',
        transition: `all 0.6s ease-out ${delay}s`
      }}
    >
      {/* Cosmic particles background */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
        <div className="absolute top-4 right-4 w-2 h-2 bg-primary rounded-full animate-pulse-glow" />
        <div className="absolute bottom-6 left-6 w-1.5 h-1.5 bg-primary/70 rounded-full animate-pulse-glow" style={{ animationDelay: '0.2s' }} />
        <div className="absolute top-1/2 left-1/4 w-1 h-1 bg-primary/50 rounded-full animate-pulse-glow" style={{ animationDelay: '0.4s' }} />
        <div className="absolute bottom-1/3 right-1/3 w-1 h-1 bg-primary/60 rounded-full animate-pulse-glow" style={{ animationDelay: '0.6s' }} />
      </div>
      
      {/* Glow effect */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 animate-shimmer" />
      <div className="absolute inset-0 bg-primary/5 blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 animate-pulse-glow" />

      <div className="text-center relative z-10">
        <div className="text-5xl font-bold bg-gradient-to-r from-primary via-primary/80 to-primary bg-clip-text text-transparent mb-2 transition-all group-hover:scale-110 drop-shadow-[0_0_20px_rgba(6,182,212,0.5)] animate-pulse-glow">
          {stat.prefix || ""}{count.toLocaleString()}{stat.suffix}
        </div>
        <div className="text-muted-foreground group-hover:text-foreground transition-colors font-semibold">
          {stat.label}
        </div>
      </div>
      
      {/* Corner glow */}
      <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-primary/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-bl-full" />
    </div>
  );
};

export default Stats;
