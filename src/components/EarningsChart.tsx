import { useEffect, useRef, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';
import { TrendingUp } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';

interface CountUpProps {
  end: number;
  duration?: number;
  suffix?: string;
  prefix?: string;
  decimals?: number;
  isVisible: boolean;
}

const CountUp = ({ end, duration = 2000, suffix = '', prefix = '', decimals = 0, isVisible }: CountUpProps) => {
  const [count, setCount] = useState(0);
  const countRef = useRef<number>();

  useEffect(() => {
    // Reset to 0 when not visible
    if (!isVisible) {
      setCount(0);
      return;
    }

    let startTime: number;
    const startValue = 0;

    const animate = (currentTime: number) => {
      if (!startTime) startTime = currentTime;
      const progress = Math.min((currentTime - startTime) / duration, 1);
      
      // Ease-out cubic
      const easedProgress = 1 - Math.pow(1 - progress, 3);
      const currentCount = startValue + (end - startValue) * easedProgress;
      
      setCount(currentCount);

      if (progress < 1) {
        countRef.current = requestAnimationFrame(animate);
      }
    };

    countRef.current = requestAnimationFrame(animate);

    return () => {
      if (countRef.current) {
        cancelAnimationFrame(countRef.current);
      }
    };
  }, [end, duration, isVisible]);

  const formatNumber = (num: number) => {
    if (decimals > 0) {
      return num.toFixed(decimals);
    }
    return Math.floor(num).toLocaleString();
  };

  return (
    <span>
      {prefix}{formatNumber(count)}{suffix}
    </span>
  );
};

const EarningsChart = () => {
  const { t } = useTranslation();
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        // Update visibility based on intersection
        setIsVisible(entry.isIntersecting);
      },
      { threshold: 0.2 }
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
  
  const data = [
    { month: `${t.earnings.month} 1`, earnings: 2500, label: '2-3k+' },
    { month: `${t.earnings.month} 2`, earnings: 4000, label: '3-5k+' },
    { month: `${t.earnings.month} 3`, earnings: 6000, label: '5-7k+' },
    { month: `${t.earnings.month} 4`, earnings: 8000, label: '7-9k+' },
    { month: `${t.earnings.month} 5`, earnings: 10000, label: '9-11k+' },
    { month: `${t.earnings.month} 6`, earnings: 12000, label: '11-13k+' },
    { month: `${t.earnings.month} 7`, earnings: 14000, label: '13-15k+' },
    { month: `${t.earnings.month} 8`, earnings: 16000, label: '15-17k+' },
    { month: `${t.earnings.month} 9`, earnings: 18000, label: '17-19k+' },
    { month: `${t.earnings.month} 10`, earnings: 19500, label: '18-20k+' },
    { month: `${t.earnings.month} 11`, earnings: 21000, label: '19-22k+' },
    { month: `${t.earnings.month} 12`, earnings: 23000, label: '20k++' },
  ];

  const CustomTooltip = ({ active, payload }: any) => {
    const [displayValue, setDisplayValue] = useState(0);
    const animationRef = useRef<number>();

    useEffect(() => {
      if (active && payload && payload.length) {
        const targetValue = payload[0].value;
        const duration = 800; // Animation duration in ms
        const startTime = Date.now();
        const startValue = 0;

        const animate = () => {
          const elapsed = Date.now() - startTime;
          const progress = Math.min(elapsed / duration, 1);
          // Ease-out cubic
          const easedProgress = 1 - Math.pow(1 - progress, 3);
          const currentValue = startValue + (targetValue - startValue) * easedProgress;
          
          setDisplayValue(Math.round(currentValue));

          if (progress < 1) {
            animationRef.current = requestAnimationFrame(animate);
          }
        };

        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current);
        }
        animate();

        return () => {
          if (animationRef.current) {
            cancelAnimationFrame(animationRef.current);
          }
        };
      } else {
        setDisplayValue(0);
      }
    }, [active, payload]);

    if (active && payload && payload.length) {
      return (
        <div className="bg-card/95 backdrop-blur-md border border-primary/30 rounded-lg p-3 shadow-xl">
          <p className="text-sm font-semibold text-foreground">{payload[0].payload.month}</p>
          <p className="text-lg font-bold text-primary transition-transform duration-300">
            ${displayValue.toLocaleString()}+
          </p>
        </div>
      );
    }
    return null;
  };

  // Use full data set for smooth line animation
  const visibleData = data;

  return (
    <section 
      ref={sectionRef}
      className="py-20 px-4 relative overflow-hidden"
    >
      <div className="container mx-auto max-w-6xl">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 mb-4 px-4 py-2 rounded-full bg-primary/10 border border-primary/20">
            <div className="p-2 rounded-lg bg-primary/20">
              <TrendingUp className="h-5 w-5 text-primary" />
            </div>
            <span className="text-sm font-semibold text-primary uppercase tracking-wider">
              {t.earnings.badge}
            </span>
          </div>
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            {t.earnings.title} <span className="text-primary">
              <CountUp end={20000} prefix="$" suffix="+" isVisible={isVisible} duration={2500} />
            </span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            {t.earnings.description}
          </p>
        </div>

        {/* Chart */}
        <div className="relative">
          {/* Decorative glow */}
          <div className="absolute inset-0 bg-primary/5 rounded-3xl blur-3xl" />
          
          {/* Chart container */}
          <div className="relative bg-card/50 backdrop-blur-sm border-2 border-primary/20 rounded-2xl p-3 md:p-6 lg:p-8 shadow-2xl shadow-primary/10">
            <ResponsiveContainer width="100%" height={400}>
              <AreaChart data={visibleData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorEarnings" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                <XAxis 
                  dataKey="month" 
                  stroke="hsl(var(--muted-foreground))"
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  tickLine={{ stroke: 'hsl(var(--border))' }}
                />
                <YAxis 
                  stroke="hsl(var(--muted-foreground))"
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  tickLine={{ stroke: 'hsl(var(--border))' }}
                  tickFormatter={(value) => `$${value / 1000}k`}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'hsl(var(--primary))', strokeWidth: 2 }} />
                <Area 
                  type="monotone" 
                  dataKey="earnings" 
                  stroke="hsl(var(--primary))" 
                  strokeWidth={3}
                  fill="url(#colorEarnings)" 
                  isAnimationActive
                  animationDuration={3000}
                  animationEasing="ease-in-out"
                />
              </AreaChart>
            </ResponsiveContainer>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4 mt-8 pt-6 border-t border-border/50">
              <div className="text-center">
                <p className="text-2xl md:text-3xl font-bold text-primary">
                  <CountUp end={2.5} prefix="$" suffix="k" decimals={1} isVisible={isVisible} duration={2000} />
                </p>
                <p className="text-sm text-muted-foreground mt-1">{t.earnings.start}</p>
              </div>
              <div className="text-center">
                <p className="text-2xl md:text-3xl font-bold text-primary">
                  <CountUp end={12} prefix="$" suffix="k" isVisible={isVisible} duration={2000} />
                </p>
                <p className="text-sm text-muted-foreground mt-1">{t.earnings.months6}</p>
              </div>
              <div className="text-center">
                <p className="text-2xl md:text-3xl font-bold text-primary">
                  <CountUp end={23} prefix="$" suffix="k+" isVisible={isVisible} duration={2000} />
                </p>
                <p className="text-sm text-muted-foreground mt-1">{t.earnings.months12}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default EarningsChart;
