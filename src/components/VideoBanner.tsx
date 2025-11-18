import promoVideo from "@/assets/promo-video.mp4";

const VideoBanner = () => {
  return (
    <section className="relative w-full h-[400px] overflow-hidden">
      {/* Video Background */}
      <video
        src={promoVideo}
        autoPlay
        loop
        muted
        playsInline
        className="absolute inset-0 w-full h-full object-cover"
      />
      
      {/* Gradient Overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-background/40 to-background/60" />
      
      {/* Content */}
      <div className="relative h-full flex items-center justify-center">
        <div className="text-center space-y-4 px-4">
          <h1 className="text-5xl md:text-7xl font-bold text-white drop-shadow-2xl animate-text-shimmer">
            APOLLO PRODUCTION
          </h1>
          <p className="text-xl md:text-2xl text-white/90 drop-shadow-lg">
            OnlyFans Management Agency
          </p>
          <div className="w-32 h-1 bg-primary mx-auto rounded-full shadow-lg shadow-primary/50" />
        </div>
      </div>
      
      {/* Bottom fade */}
      <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-background to-transparent" />
    </section>
  );
};

export default VideoBanner;
