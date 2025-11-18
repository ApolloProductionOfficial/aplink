import { Button } from "@/components/ui/button";
import { useButtonSound } from "@/hooks/useButtonSound";
import { ArrowLeft, CheckCircle, Clock, Shield, Zap } from "lucide-react";
import { useNavigate } from "react-router-dom";

const CryptoUnlock = () => {
  const { playClickSound } = useButtonSound();
  const navigate = useNavigate();

  const features = [
    {
      icon: Clock,
      title: "24 часа",
      description: "Разблокировка за 24 часа с момента обращения"
    },
    {
      icon: CheckCircle,
      title: "70+ кейсов",
      description: "Более 70 успешных разблокировок криптовалютных платежей"
    },
    {
      icon: Shield,
      title: "Гарантия",
      description: "100% гарантия разблокировки или возврат средств"
    },
    {
      icon: Zap,
      title: "Fansly",
      description: "Специализация на платформе Fansly"
    }
  ];

  const howItWorks = [
    {
      step: "1",
      title: "Обращение",
      description: "Свяжитесь с нами через Telegram и опишите ситуацию"
    },
    {
      step: "2",
      title: "Анализ",
      description: "Мы проанализируем вашу ситуацию и предложим решение"
    },
    {
      step: "3",
      title: "Разблокировка",
      description: "Выполним разблокировку в течение 24 часов"
    },
    {
      step: "4",
      title: "Проверка",
      description: "Убедимся, что всё работает корректно"
    }
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <Button
          variant="ghost"
          onClick={() => {
            playClickSound();
            navigate('/');
          }}
          className="mb-6"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Назад
        </Button>

        <div className="mb-12">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Разблокировка криптовалюты</h1>
          <p className="text-lg text-muted-foreground">
            Профессиональная разблокировка криптовалютных платежей на Fansly. Быстро, безопасно, с гарантией.
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {features.map((feature, index) => (
            <div
              key={index}
              className="bg-card border border-border rounded-lg p-6 text-center hover:border-primary/50 transition-all duration-300"
            >
              <feature.icon className="h-12 w-12 text-primary mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
              <p className="text-sm text-muted-foreground">{feature.description}</p>
            </div>
          ))}
        </div>

        {/* How It Works */}
        <div className="mb-12">
          <h2 className="text-3xl font-bold mb-8 text-center">Как это работает</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {howItWorks.map((item, index) => (
              <div key={index} className="relative">
                <div className="bg-card border border-border rounded-lg p-6">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                    <span className="text-2xl font-bold text-primary">{item.step}</span>
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{item.title}</h3>
                  <p className="text-sm text-muted-foreground">{item.description}</p>
                </div>
                {index < howItWorks.length - 1 && (
                  <div className="hidden lg:block absolute top-1/2 -right-3 w-6 h-0.5 bg-border" />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Benefits Section */}
        <div className="bg-card/50 border border-border rounded-lg p-8 mb-12">
          <h2 className="text-2xl font-bold mb-6">Что вы получаете</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="flex items-start gap-3">
              <CheckCircle className="h-5 w-5 text-primary mt-1 flex-shrink-0" />
              <div>
                <h4 className="font-semibold mb-1">Быстрая разблокировка</h4>
                <p className="text-sm text-muted-foreground">Решаем проблему за 24 часа</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle className="h-5 w-5 text-primary mt-1 flex-shrink-0" />
              <div>
                <h4 className="font-semibold mb-1">Опыт и экспертиза</h4>
                <p className="text-sm text-muted-foreground">70+ успешных кейсов</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle className="h-5 w-5 text-primary mt-1 flex-shrink-0" />
              <div>
                <h4 className="font-semibold mb-1">Безопасность</h4>
                <p className="text-sm text-muted-foreground">Работаем строго в рамках правил платформы</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle className="h-5 w-5 text-primary mt-1 flex-shrink-0" />
              <div>
                <h4 className="font-semibold mb-1">Гарантия результата</h4>
                <p className="text-sm text-muted-foreground">Возврат средств при отсутствии результата</p>
              </div>
            </div>
          </div>
        </div>

        {/* CTA Section */}
        <div className="bg-card/50 border border-border rounded-lg p-8 text-center">
          <h2 className="text-2xl font-bold mb-4">Нужна разблокировка?</h2>
          <p className="text-muted-foreground mb-6">
            Свяжитесь с нами для консультации. Мы поможем решить вашу проблему быстро и безопасно.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              size="lg"
              onClick={() => {
                playClickSound();
                window.open('https://t.me/Apollo_Production', '_blank');
              }}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              Связаться в Telegram
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => {
                playClickSound();
                window.open('https://docs.google.com/forms/d/e/1FAIpQLSdImReNAMa_AQ74PYbBosGLMbm7FJnSaGkuq-QIJDlDNdnW5Q/viewform', '_blank');
              }}
              className="border-border hover:bg-accent/10"
            >
              Заполнить анкету
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CryptoUnlock;