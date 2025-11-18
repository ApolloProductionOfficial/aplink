import Header from "@/components/Header";
import Hero from "@/components/Hero";
import TrafficSources from "@/components/TrafficSources";
import Services from "@/components/Services";
import Stats from "@/components/Stats";
import CTA from "@/components/CTA";
import Footer from "@/components/Footer";
import AnimatedBackground from "@/components/AnimatedBackground";

const Index = () => {
  return (
    <div className="min-h-screen bg-background text-foreground relative">
      <AnimatedBackground />
      <Header />
      <Hero />
      <TrafficSources />
      <Services />
      <Stats />
      <CTA />
      <Footer />
    </div>
  );
};

export default Index;
