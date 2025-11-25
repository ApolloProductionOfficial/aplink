import { lazy, Suspense } from "react";
import Header from "@/components/Header";
import VideoBanner from "@/components/VideoBanner";
import Hero from "@/components/Hero";
import AnimatedBackground from "@/components/AnimatedBackground";
import StarField from "@/components/StarField";
import ScrollProgress from "@/components/ScrollProgress";
import { useScrollAnimation } from "@/hooks/useScrollAnimation";

// Lazy load heavy components
const Sidebar = lazy(() => import("@/components/Sidebar"));
const NewsWidget = lazy(() => import("@/components/NewsWidget"));
const AIChatBot = lazy(() => import("@/components/AIChatBot"));
const MobileThemesNews = lazy(() => import("@/components/MobileThemesNews"));
const FeaturedServices = lazy(() => import("@/components/FeaturedServices"));
const EarningsChart = lazy(() => import("@/components/EarningsChart"));
const TrafficSources = lazy(() => import("@/components/TrafficSources"));
const CTA = lazy(() => import("@/components/CTA"));
const Footer = lazy(() => import("@/components/Footer"));
const BottomNavigation = lazy(() => import("@/components/BottomNavigation"));

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
      <Suspense fallback={<div />}>
        <Sidebar />
        <NewsWidget />
        <AIChatBot />
        <BottomNavigation />
      </Suspense>
      <div className="lg:pl-80 xl:pr-80">
        <VideoBanner />
        <Hero />
        <Suspense fallback={<div className="h-20" />}>
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
        </Suspense>
      </div>
    </div>
  );
};

export default Index;
