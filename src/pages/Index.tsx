import Header from "@/components/Header";
import Hero from "@/components/Hero";
import About from "@/components/About";
import Services from "@/components/Services";
import Stats from "@/components/Stats";
import Footer from "@/components/Footer";
import AnimatedBackground from "@/components/AnimatedBackground";

const Index = () => {
  return (
    <div className="min-h-screen bg-background text-foreground relative">
      <AnimatedBackground />
      <Header />
      <Hero />
      <About />
      <Services />
      <Stats />
      <Footer />
    </div>
  );
};

export default Index;
