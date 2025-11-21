import { lazy, Suspense } from "react";
import TopBanner from "@/components/TopBanner";
import Header from "@/components/Header";
import VideoBanner from "@/components/VideoBanner";
import MobileMenu from "@/components/MobileMenu";
import MobileThemesNews from "@/components/MobileThemesNews";
import MobileTopServices from "@/components/MobileTopServices";
import ServiceBadges from "@/components/ServiceBadges";
import Hero from "@/components/Hero";
import EarningsChart from "@/components/EarningsChart";
import Stats from "@/components/Stats";
import TrafficSources from "@/components/TrafficSources";
import CTA from "@/components/CTA";
import Footer from "@/components/Footer";
import AnimatedBackground from "@/components/AnimatedBackground";
import { useScrollAnimation } from "@/hooks/useScrollAnimation";

// Lazy load heavy components
const Sidebar = lazy(() => import("@/components/Sidebar"));
const NewsWidget = lazy(() => import("@/components/NewsWidget"));
const AIChatBot = lazy(() => import("@/components/AIChatBot"));
const StarField = lazy(() => import("@/components/StarField"));

const Index = () => {
  const serviceBadgesAnim = useScrollAnimation();
  const earningsChartAnim = useScrollAnimation();
  const trafficSourcesAnim = useScrollAnimation();
  const ctaAnim = useScrollAnimation();

  return (
    <div className="min-h-screen bg-background text-foreground relative">
      <AnimatedBackground />
      <Suspense fallback={<div className="fixed inset-0 pointer-events-none z-0" />}>
        <StarField />
      </Suspense>
      <TopBanner />
      <Header />
      <Suspense fallback={<div className="hidden lg:block" />}>
        <Sidebar />
      </Suspense>
      <Suspense fallback={<div className="hidden xl:block" />}>
        <NewsWidget />
      </Suspense>
      <Suspense fallback={null}>
        <AIChatBot />
      </Suspense>
      <MobileMenu />
      <div className="lg:pl-80 xl:pr-80">
        <VideoBanner />
        <Hero />
        <div
          ref={serviceBadgesAnim.elementRef}
          className={`transition-all duration-700 ${
            serviceBadgesAnim.isVisible
              ? 'opacity-100 translate-y-0'
              : 'opacity-0 translate-y-12'
          }`}
        >
          <ServiceBadges />
        </div>
        <MobileThemesNews />
        <MobileTopServices />
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
