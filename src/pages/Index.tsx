import Header from "@/components/Header";
import VideoBanner from "@/components/VideoBanner";
import Hero from "@/components/Hero";
import AnimatedBackground from "@/components/AnimatedBackground";
import StarField from "@/components/StarField";
import ScrollProgress from "@/components/ScrollProgress";
import { useScrollAnimation } from "@/hooks/useScrollAnimation";
import Sidebar from "@/components/Sidebar";
import NewsWidget from "@/components/NewsWidget";
import AIChatBot from "@/components/AIChatBot";
import MobileThemesNews from "@/components/MobileThemesNews";
import FeaturedServices from "@/components/FeaturedServices";
import EarningsChart from "@/components/EarningsChart";
import TrafficSources from "@/components/TrafficSources";
import CTA from "@/components/CTA";
import Footer from "@/components/Footer";
import BottomNavigation from "@/components/BottomNavigation";

const Index = () => {
  const earningsChartAnim = useScrollAnimation();
  const trafficSourcesAnim = useScrollAnimation();
  const ctaAnim = useScrollAnimation();

  return (
    <div className="min-h-screen bg-background text-foreground relative pb-20 md:pb-0">
      <AnimatedBackground />
      <StarField />
      <ScrollProgress />
      <Header />
      <Sidebar />
      <NewsWidget />
      <AIChatBot />
      <BottomNavigation />
      <div className="lg:pl-80 xl:pr-80">
        <VideoBanner />
        <Hero />
        <MobileThemesNews />
        <FeaturedServices />
        <div
          ref={earningsChartAnim.elementRef}
          className={`transition-all duration-700 ${
            earningsChartAnim.isVisible
              ? 'opacity-100 translate-y-0'
              : 'opacity-0 translate-y-12'
          }`}
          style={{ transitionDelay: '100ms' }}
        >
          <EarningsChart />
        </div>
        <div
          ref={trafficSourcesAnim.elementRef}
          className={`transition-all duration-700 ${
            trafficSourcesAnim.isVisible
              ? 'opacity-100 translate-y-0'
              : 'opacity-0 translate-y-12'
          }`}
          style={{ transitionDelay: '200ms' }}
        >
          <TrafficSources />
        </div>
        <div
          ref={ctaAnim.elementRef}
          className={`transition-all duration-700 ${
            ctaAnim.isVisible
              ? 'opacity-100 translate-y-0'
              : 'opacity-0 translate-y-12'
          }`}
          style={{ transitionDelay: '300ms' }}
        >
          <CTA />
        </div>
        <Footer />
      </div>
    </div>
  );
};

export default Index;
