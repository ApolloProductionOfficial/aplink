import { Card } from "@/components/ui/card";
import { Star, TrendingUp } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";

const Testimonials = () => {
  const { t } = useTranslation();

  const testimonials = [
    {
      name: "Sofia M.",
      role: "Content Creator",
      image: "🌸",
      rating: 5,
      beforeIncome: "$800",
      afterIncome: "$12,500",
      comment: t.testimonials?.feedback1 || "Apollo Production transformed my career. In 6 months, my income increased 15x!",
      months: 6
    },
    {
      name: "Anna K.",
      role: "Model",
      image: "💎",
      rating: 5,
      beforeIncome: "$1,200",
      afterIncome: "$18,000",
      comment: t.testimonials?.feedback2 || "Professional team, excellent traffic sources, and constant support. Best decision I made!",
      months: 8
    },
    {
      name: "Elena R.",
      role: "Influencer",
      image: "✨",
      rating: 5,
      beforeIncome: "$500",
      afterIncome: "$9,800",
      comment: t.testimonials?.feedback3 || "The agency handles everything - I just focus on content. Results speak for themselves!",
      months: 4
    }
  ];

  return (
    <section className="py-20 px-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-primary opacity-5" />
      <div className="container mx-auto relative z-10">
        <div className="text-center mb-12">
          <div className="inline-block mb-4 px-4 py-2 rounded-full bg-primary/10 border border-primary/20">
            <span className="text-sm font-semibold text-primary uppercase tracking-wider">
              {t.testimonials?.badge || "Success Stories"}
            </span>
          </div>
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            {t.testimonials?.title || "Real Results from Real Models"}
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            {t.testimonials?.subtitle || "See how our models transformed their income"}
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {testimonials.map((testimonial, index) => (
            <Card 
              key={index}
              className="p-6 glass-dark border-primary/20 hover:border-primary/40 transition-all duration-500 hover:scale-105 hover:-translate-y-2 group"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <div className="flex items-start gap-4 mb-4">
                <div className="text-4xl">{testimonial.image}</div>
                <div className="flex-1">
                  <h4 className="font-bold text-lg">{testimonial.name}</h4>
                  <p className="text-sm text-muted-foreground">{testimonial.role}</p>
                  <div className="flex gap-1 mt-1">
                    {Array.from({ length: testimonial.rating }).map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-primary text-primary" />
                    ))}
                  </div>
                </div>
              </div>

              <div className="bg-background/50 rounded-lg p-4 mb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">
                      {t.testimonials?.before || "Before"}
                    </p>
                    <p className="text-lg font-semibold">{testimonial.beforeIncome}</p>
                  </div>
                  <TrendingUp className="w-6 h-6 text-primary animate-pulse-glow" />
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">
                      {t.testimonials?.after || "After"}
                    </p>
                    <p className="text-lg font-bold text-primary">{testimonial.afterIncome}</p>
                  </div>
                </div>
                <p className="text-xs text-center text-muted-foreground mt-2">
                  {t.testimonials?.period || "in"} {testimonial.months} {t.testimonials?.months || "months"}
                </p>
              </div>

              <p className="text-sm text-muted-foreground italic">
                "{testimonial.comment}"
              </p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Testimonials;
