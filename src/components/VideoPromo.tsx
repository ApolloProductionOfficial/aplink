import promoVideo from "@/assets/promo-video.mp4";

const VideoPromo = () => {
  return (
    <section className="py-20 px-4 relative overflow-hidden">
      <div className="container mx-auto max-w-5xl">
        <div className="relative">
          {/* Decorative glow */}
          <div className="absolute inset-0 bg-primary/10 rounded-3xl blur-3xl" />
          
          {/* Video container */}
          <div className="relative bg-background/50 backdrop-blur-sm border-2 border-primary/30 rounded-2xl p-2 shadow-2xl shadow-primary/20">
            <video
              src={promoVideo}
              autoPlay
              loop
              muted
              playsInline
              className="w-full h-auto rounded-xl"
              style={{
                boxShadow: '0 0 40px hsl(var(--primary) / 0.4)'
              }}
            />
          </div>
        </div>
      </div>
    </section>
  );
};

export default VideoPromo;
