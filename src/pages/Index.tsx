import TopBanner from "@/components/TopBanner";
import Header from "@/components/Header";
import VideoBanner from "@/components/VideoBanner";
import Sidebar from "@/components/Sidebar";
import RightSidebar from "@/components/RightSidebar";
import Hero from "@/components/Hero";
import VideoPromo from "@/components/VideoPromo";
import TrafficSources from "@/components/TrafficSources";
import CTA from "@/components/CTA";
import Footer from "@/components/Footer";
import AnimatedBackground from "@/components/AnimatedBackground";
import MusicPlayer from "@/components/MusicPlayer";

const Index = () => {
  return (
    <div className="min-h-screen bg-background text-foreground relative">
      <AnimatedBackground />
      <MusicPlayer />
      <TopBanner />
      <Header />
      <VideoBanner />
      <Sidebar />
      <RightSidebar />
      <div className="lg:pl-80 xl:pr-80">
        <Hero />
        <VideoPromo />
        <TrafficSources />
        <CTA />
        <Footer />
      </div>
    </div>
  );
};

export default Index;
