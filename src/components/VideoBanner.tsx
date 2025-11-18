import promoVideo from "@/assets/promo-video.mp4";

const VideoBanner = () => {
  return (
    <section className="fixed top-[92px] left-0 right-0 h-[400px] overflow-hidden z-30">
      {/* Video Background */}
      <video
        src={promoVideo}
        autoPlay
        loop
        muted
        playsInline
        className="absolute inset-0 w-full h-full object-cover"
      />
      
      {/* Darkening overlays on sides for sidebar readability */}
      <div className="absolute left-0 top-0 bottom-0 w-80 bg-gradient-to-r from-background/90 via-background/60 to-transparent lg:block hidden" />
      <div className="absolute right-0 top-0 bottom-0 w-80 bg-gradient-to-l from-background/90 via-background/60 to-transparent xl:block hidden" />
      
      {/* Bottom fade */}
      <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-background to-transparent" />
    </section>
  );
};

export default VideoBanner;
