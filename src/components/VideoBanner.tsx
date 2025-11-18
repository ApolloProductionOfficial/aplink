import promoVideo from "@/assets/promo-video.mp4";

const VideoBanner = () => {
  return (
    <section className="relative w-full overflow-hidden">
      <div className="relative h-[400px]">
        {/* Video Background */}
        <video
          src={promoVideo}
          autoPlay
          loop
          muted
          playsInline
          className="absolute inset-0 w-full h-full object-cover rounded-lg"
        />
        
        {/* Bottom fade */}
        <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-background to-transparent" />
      </div>
    </section>
  );
};

export default VideoBanner;
