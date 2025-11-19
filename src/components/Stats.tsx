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
  const [hasAnimated, setHasAnimated] = useState(false);

  useEffect(() => {
    if (isVisible && !hasAnimated) {
      setHasAnimated(true);
      let currentCount = 0;
      const increment = Math.ceil(stat.value / 50);
      const timer = setInterval(() => {
        currentCount += increment;
        if (currentCount >= stat.value) {
          setCount(stat.value);
          clearInterval(timer);
        } else {
          setCount(currentCount);
        }
      }, 30);
      return () => clearInterval(timer);
    }
  }, [isVisible, stat.value, hasAnimated]);

  return (
    <div
      className="bg-gradient-card backdrop-blur-xl rounded-2xl p-8 border border-border hover:shadow-glow transition-all duration-500 group hover:scale-105 animate-pulse-glow"
      style={{ 
        animationDelay: `${delay}s`,
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? 'translateY(0)' : 'translateY(30px)',
        transition: `all 0.6s ease-out ${delay}s`
      }}
    >
      <div className="text-center">
        <div className="text-5xl font-bold text-primary mb-2 transition-all group-hover:scale-110">
          {stat.prefix}{count.toLocaleString()}{stat.suffix}
        </div>
        <div className="text-muted-foreground group-hover:text-foreground transition-colors">
          {stat.label}
        </div>
      </div>
    </div>
  );
};

export default Stats;
