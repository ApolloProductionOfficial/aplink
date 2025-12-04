import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Video, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import AnimatedBackground from "@/components/AnimatedBackground";
import StarField from "@/components/StarField";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-background text-foreground relative overflow-hidden flex items-center justify-center">
      <AnimatedBackground />
      <StarField />
      
      <div className="relative z-10 text-center px-4">
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center mx-auto mb-8 animate-pulse-glow">
          <Video className="w-10 h-10 text-primary-foreground" />
        </div>
        
        <h1 className="text-7xl font-bold mb-4 bg-gradient-to-r from-foreground to-primary bg-clip-text text-transparent">
          404
        </h1>
        
        <p className="text-xl text-muted-foreground mb-8">
          Комната не найдена или была удалена
        </p>
        
        <Button asChild size="lg" className="bg-primary hover:bg-primary/90">
          <Link to="/">
            <Home className="w-5 h-5 mr-2" />
            Вернуться на главную
          </Link>
        </Button>
      </div>
    </div>
  );
};

export default NotFound;
