const About = () => {
  return (
    <section id="about" className="py-20 px-4 relative">
      <div className="container mx-auto">
        <div className="max-w-4xl mx-auto text-center animate-slide-up">
          <span className="text-sm font-semibold text-primary bg-primary/10 px-4 py-2 rounded-full inline-block mb-4 animate-pulse-glow">
            О нас
          </span>
          <h2 className="text-4xl font-bold mt-4 mb-6 bg-gradient-to-r from-foreground via-primary to-foreground bg-clip-text text-transparent animate-gradient">
            OnlyFans Management Agency
          </h2>
          <p className="text-xl text-muted-foreground leading-relaxed hover:text-foreground/90 transition-colors">
            5 лет на рынке. Помогали открывать агентства, сейчас строим своё — на лучшем из опыта и ошибок. 
            Вы — создаёте, мы — масштабируем.
          </p>
        </div>
      </div>
    </section>
  );
};

export default About;
