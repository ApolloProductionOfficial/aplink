import { useButtonSound } from "@/hooks/useButtonSound";
import { useTranslation } from "@/hooks/useTranslation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import AnimatedBackground from "@/components/AnimatedBackground";

const InstagramAutomation = () => {
  const { playClickSound } = useButtonSound();
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-background text-foreground relative">
      <AnimatedBackground />
      <Header />
      
      <main className="container mx-auto px-4 py-20 max-w-4xl">
        <div className="space-y-8 animate-slide-up">
          
          {/* Title */}
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold mb-4 animate-text-shimmer">
              📱 Автоматизация и Софты
            </h1>
            <p className="text-xl text-primary">
              🚀 APOLLO PRODUCTION
            </p>
            <p className="text-lg text-muted-foreground">
              [ Instagram → OnlyFans трафик ]
            </p>
          </div>

          {/* Device Capacity */}
          <div className="bg-card/50 backdrop-blur-sm border border-border rounded-lg p-6 space-y-4">
            <h2 className="text-2xl font-bold text-primary mb-4">
              ┏━━━━━━━━━━━━━━━━━━━━━━┓<br/>
              ┃ 📰 ЁМКОСТЬ УСТРОЙСТВ<br/>
              ┗━━━━━━━━━━━━━━━━━━━━━━┛
            </h2>
            <ul className="space-y-2 text-lg">
              <li>🔘 200-400+ IG-аккаунтов / устройство</li>
              <li>🔘 10 девайсов = 2,500+ аккаунтов</li>
              <li>🔘 20 девайсов = 5,000+ аккаунтов</li>
              <li className="text-primary">➜ Масштаб без просадки качества</li>
            </ul>
          </div>

          {/* AI Live 24/7 */}
          <div className="bg-card/50 backdrop-blur-sm border border-border rounded-lg p-6 space-y-4">
            <h2 className="text-2xl font-bold text-primary mb-4">
              ┏━━━━━━━━━━━━━━━━━━━━━━┓<br/>
              ┃ 💬 ИИ В ЛАЙВЕ 24/7<br/>
              ┗━━━━━━━━━━━━━━━━━━━━━━┛
            </h2>
            <ul className="space-y-2 text-lg">
              <li>✅ Отвечает «как человек» в DM/сторис</li>
              <li>✅ Ведёт к OF по ссылке в BIO</li>
              <li>✅ Автоперевод на нужные языки</li>
              <li>✅ Скрипты под нишу + анти‑спам тайминги</li>
            </ul>
          </div>

          {/* Web Cabinet */}
          <div className="bg-card/50 backdrop-blur-sm border border-border rounded-lg p-6 space-y-4">
            <h2 className="text-2xl font-bold text-primary mb-4">
              ┏━━━━━━━━━━━━━━━━━━━━━━┓<br/>
              ┃ 🏪 ВЕБ‑КАБИНЕТ<br/>
              ┗━━━━━━━━━━━━━━━━━━━━━━┛
            </h2>
            <ul className="space-y-2 text-lg">
              <li>✅ Онлайн‑дашборд</li>
              <li>✅ Обзор каждого устройства</li>
              <li>✅ DM, клики BIO, подписки OF, CR/EPC, логи, роли доступа и т.д.</li>
            </ul>
          </div>

          {/* Technologies */}
          <div className="bg-card/50 backdrop-blur-sm border border-border rounded-lg p-6 space-y-4">
            <h2 className="text-2xl font-bold text-primary mb-4">
              ┏━━━━━━━━━━━━━━━━━━━━━━┓<br/>
              ┃ ⚙️ ТЕХНОЛОГИИ<br/>
              ┗━━━━━━━━━━━━━━━━━━━━━━┛
            </h2>
            <ul className="space-y-2 text-lg">
              <li>✅ Телефоны только НОВОГО поколения, повышенный TRUST</li>
              <li>✅ Индивидуальные мобильные прокси</li>
              <li>✅ Проф. стойки + охлаждение 24/7</li>
              <li>✅ 99.9% аптайм, авто‑бэкапы, авто‑рестор</li>
            </ul>
          </div>

          {/* What You Get */}
          <div className="bg-card/50 backdrop-blur-sm border border-border rounded-lg p-6 space-y-4">
            <h2 className="text-2xl font-bold text-primary mb-4">
              ┏━━━━━━━━━━━━━━━━━━━━━━┓<br/>
              ┃ ❔ ЧТО ПОЛУЧАЕТЕ<br/>
              ┗━━━━━━━━━━━━━━━━━━━━━━┛
            </h2>
            <ul className="space-y-2 text-lg">
              <li>✅ Telegram‑бот управления</li>
              <li>✅ Обучение + ИИ‑скрипты</li>
              <li>✅ Поддержка 24/7</li>
              <li>✅ OF‑воронка под вашу нишу</li>
            </ul>
          </div>

          {/* Launch */}
          <div className="bg-card/50 backdrop-blur-sm border border-border rounded-lg p-6 space-y-4">
            <h2 className="text-2xl font-bold text-primary mb-4">
              ┏━━━━━━━━━━━━━━━━━━━━━━┓<br/>
              ┃ ⚡️ ЗАПУСК<br/>
              ┗━━━━━━━━━━━━━━━━━━━━━━┛
            </h2>
            <ul className="space-y-2 text-lg">
              <li>➜ Созвон → выбор пакета</li>
              <li>➜ Настройка и старт: 2–3 недели</li>
              <li>➜ Масштаб без лимитов</li>
            </ul>
          </div>

          {/* CTA */}
          <div className="text-center bg-gradient-to-r from-primary/20 to-primary/10 rounded-lg p-8 border border-primary/30">
            <p className="text-2xl font-bold mb-4">🔥 ГОТОВЫ ПОКАЗАТЬ</p>
            <p className="text-lg mb-6">🔘 Демо ИИ и веб‑кабинета</p>
            <a
              href="https://t.me/Apollo_Production"
              onClick={playClickSound}
              className="inline-block bg-primary hover:bg-primary/90 text-primary-foreground px-8 py-3 rounded-lg font-semibold transition-all duration-300 hover:scale-105"
            >
              🔘 Для связи → @Apollo_Production
            </a>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default InstagramAutomation;
