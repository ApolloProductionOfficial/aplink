import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { ArrowLeft, Instagram, Music, MessageSquare, HelpCircle, DollarSign, Smartphone, MessageCircle, Globe, Settings, Zap, Package } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { useButtonSound } from "@/hooks/useButtonSound";

const InstagramAutomation = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { playClickSound } = useButtonSound();
  const [activePlatform, setActivePlatform] = useState<'instagram' | 'tiktok' | 'reddit'>('instagram');
  const [devices, setDevices] = useState(10);

  const handleBack = () => {
    playClickSound();
    navigate('/');
  };

  const handleContact = () => {
    playClickSound();
    window.open('https://t.me/Apollo_Production', '_blank');
  };

  // ROI Calculator logic
  const accountsPerDevice = 300;
  const totalAccounts = devices * accountsPerDevice;
  const avgConversionRate = 0.02;
  const avgRevenuePerSubscriber = 15;
  const monthlyRevenue = totalAccounts * avgConversionRate * avgRevenuePerSubscriber;
  const setupCostPerDevice = 320; // $3200 for 10 devices = $320 per device
  const totalSetupCost = devices * setupCostPerDevice;
  const monthsToROI = monthlyRevenue > 0 ? totalSetupCost / monthlyRevenue : 0;

  const platforms = [
    { 
      id: 'instagram' as const, 
      name: 'Instagram', 
      icon: Instagram, 
      iconColor: 'text-pink-500',
      available: true 
    },
    { 
      id: 'tiktok' as const, 
      name: 'TikTok', 
      icon: Music, 
      iconColor: 'text-foreground',
      available: false 
    },
    { 
      id: 'reddit' as const, 
      name: 'Reddit', 
      icon: MessageSquare, 
      iconColor: 'text-orange-500',
      available: false 
    },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto px-4 py-8">
        <Button
          variant="ghost"
          onClick={handleBack}
          className="mb-8 hover:bg-accent/50 transition-colors"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Назад
        </Button>

        <div className="max-w-6xl mx-auto space-y-12">
          {/* Hero Section */}
          <div className="text-center space-y-4">
            <h1 className="text-4xl md:text-5xl font-bold">
              Автоматизация и Софты
            </h1>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              APOLLO PRODUCTION — Автоматизация для трафика на OnlyFans
            </p>
          </div>

          {/* Platform Selector */}
          <div className="flex flex-wrap justify-center gap-4 mb-12">
            {platforms.map((platform) => {
              const Icon = platform.icon;
              return (
                <button
                  key={platform.id}
                  onClick={() => {
                    playClickSound();
                    setActivePlatform(platform.id);
                  }}
                  className={`relative px-8 py-4 rounded-lg border-2 transition-all duration-300 ${
                    activePlatform === platform.id
                      ? 'border-primary bg-primary/10 scale-105'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`h-6 w-6 ${platform.iconColor}`} />
                    <span className="font-semibold text-lg">{platform.name}</span>
                    {!platform.available && (
                      <span className="text-xs bg-yellow-500/20 text-yellow-500 px-2 py-1 rounded">
                        Скоро будет
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Instagram Content */}
          {activePlatform === 'instagram' && (
            <div className="space-y-8 animate-fade-in">
              <div className="text-center">
                <p className="text-primary text-lg mb-2">[ Instagram → OnlyFans трафик ]</p>
              </div>

              {/* Capacity Section */}
              <div className="border-2 border-primary/50 rounded-lg p-8 bg-card/30">
                <div className="border-b-2 border-primary/50 pb-3 mb-6">
                  <h2 className="text-2xl font-bold text-primary flex items-center gap-2">
                    <Smartphone className="h-6 w-6" />
                    ЁМКОСТЬ УСТРОЙСТВ
                  </h2>
                </div>
                <div className="space-y-3 text-lg">
                  <p className="flex items-start gap-3">
                    <span className="text-primary mt-1">•</span>
                    <span>200-400+ IG-аккаунтов / устройство</span>
                  </p>
                  <p className="flex items-start gap-3">
                    <span className="text-primary mt-1">•</span>
                    <span>10 девайсов = 2,500+ аккаунтов</span>
                  </p>
                  <p className="flex items-start gap-3">
                    <span className="text-primary mt-1">•</span>
                    <span>20 девайсов = 5,000+ аккаунтов</span>
                  </p>
                  <p className="flex items-start gap-3 text-primary">
                    <Zap className="h-5 w-5 mt-0.5" />
                    <span>Масштаб без просадки качества</span>
                  </p>
                </div>
              </div>

              {/* AI Live 24/7 */}
              <div className="border-2 border-primary/50 rounded-lg p-8 bg-card/30">
                <div className="border-b-2 border-primary/50 pb-3 mb-6">
                  <h2 className="text-2xl font-bold text-primary flex items-center gap-2">
                    <MessageCircle className="h-6 w-6" />
                    ИИ В ЛАЙВЕ 24/7
                  </h2>
                </div>
                <div className="space-y-3 text-lg">
                  <p className="flex items-start gap-3">
                    <span className="text-green-500">✓</span>
                    <span>Отвечает «как человек» в DM/сторис</span>
                  </p>
                  <p className="flex items-start gap-3">
                    <span className="text-green-500">✓</span>
                    <span>Ведёт к OF по ссылке в BIO</span>
                  </p>
                  <p className="flex items-start gap-3">
                    <span className="text-green-500">✓</span>
                    <span>Автоперевод на нужные языки</span>
                  </p>
                  <p className="flex items-start gap-3">
                    <span className="text-green-500">✓</span>
                    <span>Скрипты под нишу + анти‑спам тайминги</span>
                  </p>
                </div>
              </div>

              {/* Web Cabinet */}
              <div className="border-2 border-primary/50 rounded-lg p-8 bg-card/30">
                <div className="border-b-2 border-primary/50 pb-3 mb-6">
                  <h2 className="text-2xl font-bold text-primary flex items-center gap-2">
                    <Globe className="h-6 w-6" />
                    ВЕБ‑КАБИНЕТ
                  </h2>
                </div>
                <div className="space-y-3 text-lg">
                  <p className="flex items-start gap-3">
                    <span className="text-green-500">✓</span>
                    <span>Онлайн‑дашборд</span>
                  </p>
                  <p className="flex items-start gap-3">
                    <span className="text-green-500">✓</span>
                    <span>Обзор каждого устройства</span>
                  </p>
                  <p className="flex items-start gap-3">
                    <span className="text-green-500">✓</span>
                    <span>DM, клики BIO, подписки OF, CR/EPC, логи, роли доступа и т.д.</span>
                  </p>
                </div>
              </div>

              {/* Technologies */}
              <div className="border-2 border-primary/50 rounded-lg p-8 bg-card/30">
                <div className="border-b-2 border-primary/50 pb-3 mb-6">
                  <h2 className="text-2xl font-bold text-primary flex items-center gap-2">
                    <Settings className="h-6 w-6" />
                    ТЕХНОЛОГИИ
                  </h2>
                </div>
                <div className="space-y-3 text-lg">
                  <p className="flex items-start gap-3">
                    <span className="text-green-500">✓</span>
                    <span>Телефоны только НОВОГО поколения, повышенный TRUST</span>
                  </p>
                  <p className="flex items-start gap-3">
                    <span className="text-green-500">✓</span>
                    <span>Индивидуальные мобильные прокси</span>
                  </p>
                  <p className="flex items-start gap-3">
                    <span className="text-green-500">✓</span>
                    <span>Проф. стойки + охлаждение 24/7</span>
                  </p>
                  <p className="flex items-start gap-3">
                    <span className="text-green-500">✓</span>
                    <span>99.9% аптайм, авто‑бэкапы, авто‑рестор</span>
                  </p>
                </div>
              </div>

              {/* What You Get */}
              <div className="border-2 border-primary/50 rounded-lg p-8 bg-card/30">
                <div className="border-b-2 border-primary/50 pb-3 mb-6">
                  <h2 className="text-2xl font-bold text-primary flex items-center gap-2">
                    <Package className="h-6 w-6" />
                    ЧТО ПОЛУЧАЕТЕ
                  </h2>
                </div>
                <div className="space-y-3 text-lg">
                  <p className="flex items-start gap-3">
                    <span className="text-green-500">✓</span>
                    <span>Telegram‑бот управления</span>
                  </p>
                  <p className="flex items-start gap-3">
                    <span className="text-green-500">✓</span>
                    <span>Обучение + ИИ‑скрипты</span>
                  </p>
                  <p className="flex items-start gap-3">
                    <span className="text-green-500">✓</span>
                    <span>Поддержка 24/7</span>
                  </p>
                  <p className="flex items-start gap-3">
                    <span className="text-green-500">✓</span>
                    <span>OF‑воронка под вашу нишу</span>
                  </p>
                </div>
              </div>

              {/* Launch */}
              <div className="border-2 border-primary/50 rounded-lg p-8 bg-card/30">
                <div className="border-b-2 border-primary/50 pb-3 mb-6">
                  <h2 className="text-2xl font-bold text-primary flex items-center gap-2">
                    <Zap className="h-6 w-6" />
                    ЗАПУСК
                  </h2>
                </div>
                <div className="space-y-3 text-lg">
                  <p className="flex items-start gap-3">
                    <Zap className="h-5 w-5 text-primary mt-0.5" />
                    <span>Созвон → выбор пакета</span>
                  </p>
                  <p className="flex items-start gap-3">
                    <Zap className="h-5 w-5 text-primary mt-0.5" />
                    <span>Настройка и старт: 2–3 недели</span>
                  </p>
                  <p className="flex items-start gap-3">
                    <Zap className="h-5 w-5 text-primary mt-0.5" />
                    <span>Масштаб без лимитов</span>
                  </p>
                </div>
              </div>

              {/* ROI Calculator */}
              <section className="bg-gradient-to-br from-primary/5 to-primary/10 border-2 border-primary/30 rounded-lg p-8">
                <div className="flex items-center gap-3 mb-6">
                  <DollarSign className="h-8 w-8 text-primary" />
                  <h2 className="text-3xl font-bold">Калькулятор ROI</h2>
                </div>
                
                <div className="space-y-6">
                  <div>
                    <div className="flex justify-between items-center mb-3">
                      <label className="text-lg font-semibold">Количество устройств: {devices}</label>
                      <span className="text-sm text-muted-foreground">
                        ({totalAccounts.toLocaleString()} аккаунтов)
                      </span>
                    </div>
                    <Slider
                      value={[devices]}
                      onValueChange={(value) => setDevices(value[0])}
                      min={1}
                      max={50}
                      step={1}
                      className="mb-2"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>1 устройство</span>
                      <span>50 устройств</span>
                    </div>
                  </div>

                  <div className="grid md:grid-cols-3 gap-6 mt-8">
                    <Card className="p-6 bg-card/50 backdrop-blur">
                      <p className="text-sm text-muted-foreground mb-2">Ежемесячный доход</p>
                      <p className="text-3xl font-bold text-primary">
                        ${monthlyRevenue.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">
                        при {(avgConversionRate * 100).toFixed(1)}% конверсии в OF
                      </p>
                    </Card>

                    <Card className="p-6 bg-card/50 backdrop-blur">
                      <p className="text-sm text-muted-foreground mb-2">Стоимость запуска</p>
                      <p className="text-3xl font-bold">
                        ${totalSetupCost.toLocaleString('en-US')}
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">
                        ${setupCostPerDevice} за устройство
                      </p>
                    </Card>

                    <Card className="p-6 bg-card/50 backdrop-blur">
                      <p className="text-sm text-muted-foreground mb-2">Окупаемость</p>
                      <p className="text-3xl font-bold text-green-500">
                        {monthsToROI.toFixed(1)} мес
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">
                        при текущих показателях
                      </p>
                    </Card>
                  </div>

                  <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 mt-4">
                    <div className="flex items-start gap-2">
                      <HelpCircle className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-muted-foreground">
                        Расчет основан на средних показателях. Реальные результаты зависят от ниши, качества контента и стратегии ведения аккаунтов.
                      </p>
                    </div>
                  </div>
                </div>
              </section>

              {/* CTA */}
              <div className="text-center border-2 border-primary/30 rounded-lg p-8 bg-gradient-to-r from-primary/10 to-primary/5">
                <p className="text-2xl font-bold mb-4 flex items-center justify-center gap-2">
                  <Zap className="h-7 w-7 text-primary" />
                  ГОТОВЫ ПОКАЗАТЬ
                </p>
                <p className="text-lg mb-6">Демо ИИ и веб‑кабинета</p>
                <Button
                  size="lg"
                  onClick={handleContact}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground text-lg px-8"
                >
                  Для связи → @Apollo_Production
                </Button>
              </div>
            </div>
          )}

          {/* TikTok Content */}
          {activePlatform === 'tiktok' && (
            <div className="space-y-8 animate-fade-in">
              <div className="text-center py-20">
                <Music className="h-24 w-24 mx-auto mb-6 text-foreground" />
                <h2 className="text-3xl font-bold mb-4 flex items-center justify-center gap-3">
                  <Music className="h-8 w-8 text-foreground" />
                  Автоматизация TikTok
                </h2>
                <p className="text-xl text-muted-foreground mb-8">
                  Скоро будет доступна автоматизация для TikTok
                </p>
                <div className="max-w-2xl mx-auto bg-primary/5 border border-primary/20 rounded-lg p-6">
                  <p className="text-muted-foreground">
                    Мы работаем над внедрением автоматизации TikTok с функциями:
                  </p>
                  <ul className="mt-4 space-y-2 text-left">
                    <li className="flex items-start gap-2">
                      <span className="text-primary">•</span>
                      <span>Массовое управление TikTok аккаунтами</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary">•</span>
                      <span>ИИ-генерация контента для Stories</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary">•</span>
                      <span>Автоматические воронки к OnlyFans</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary">•</span>
                      <span>Аналитика и оптимизация трафика</span>
                    </li>
                  </ul>
                </div>
                <Button
                  size="lg"
                  onClick={handleContact}
                  className="mt-8 bg-primary hover:bg-primary/90"
                >
                  Узнать подробнее
                </Button>
              </div>
            </div>
          )}

          {/* Reddit Content */}
          {activePlatform === 'reddit' && (
            <div className="space-y-8 animate-fade-in">
              <div className="text-center py-20">
                <MessageSquare className="h-24 w-24 mx-auto mb-6 text-orange-500" />
                <h2 className="text-3xl font-bold mb-4 flex items-center justify-center gap-3">
                  <MessageSquare className="h-8 w-8 text-orange-500" />
                  Автоматизация Reddit
                </h2>
                <p className="text-xl text-muted-foreground mb-8">
                  Скоро будет доступна автоматизация для Reddit
                </p>
                <div className="max-w-2xl mx-auto bg-orange-500/5 border border-orange-500/20 rounded-lg p-6">
                  <p className="text-muted-foreground">
                    Мы работаем над внедрением автоматизации Reddit с функциями:
                  </p>
                  <ul className="mt-4 space-y-2 text-left">
                    <li className="flex items-start gap-2">
                      <span className="text-orange-500">•</span>
                      <span>Автопостинг в тематические сабреддиты</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-orange-500">•</span>
                      <span>ИИ-комментирование для вовлечения</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-orange-500">•</span>
                      <span>Управление репутацией аккаунтов</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-orange-500">•</span>
                      <span>Воронки конверсии в OnlyFans</span>
                    </li>
                  </ul>
                </div>
                <Button
                  size="lg"
                  onClick={handleContact}
                  className="mt-8 bg-orange-500 hover:bg-orange-500/90 text-white"
                >
                  Узнать подробнее
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default InstagramAutomation;
