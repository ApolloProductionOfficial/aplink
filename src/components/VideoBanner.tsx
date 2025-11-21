import { useState, useEffect, useRef } from "react";
import promoVideo from "@/assets/promo-video.mp4";

const VideoBanner = () => {
  const [isVisible, setIsVisible] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !isVisible) {
            setIsVisible(true);
            // Start video when visible
            if (videoRef.current) {
              videoRef.current.play().catch(() => {
                // Autoplay was prevented
              });
            }
          }
        });
      },
      { rootMargin: '100px' }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => observer.disconnect();
  }, [isVisible]);

  return (
    <section ref={sectionRef} className="relative w-full overflow-hidden">
      <div className="relative h-[250px] md:h-[400px] lg:h-[500px]">
        {/* Placeholder while video loads */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-background to-background" />
        
        {/* Video Background - only load when visible */}
        {isVisible && (
          <video
            ref={videoRef}
            src={promoVideo}
            loop
            muted
            playsInline
            preload="metadata"
            className="absolute inset-0 w-full h-full object-cover rounded-lg"
          />
        )}
        
        {/* Bottom fade */}
        <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-background to-transparent" />
      </div>
    </section>
  );
};

export default VideoBanner;
