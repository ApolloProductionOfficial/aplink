import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { DollarSign, TrendingUp } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";

const IncomeCalculator = () => {
  const { t } = useTranslation();
  const [subscribers, setSubscribers] = useState(100);
  const [pricePerSub, setPricePerSub] = useState(10);

  const monthlyIncome = subscribers * pricePerSub;
  const agencyTake = monthlyIncome * 0.2;
  const yourIncome = monthlyIncome * 0.8;
  const yearlyIncome = yourIncome * 12;

  return (
    <Card className="p-6 glass-dark border-primary/20 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-primary opacity-5" />
      <div className="relative z-10">
        <div className="flex items-center gap-2 mb-6">
          <DollarSign className="w-6 h-6 text-primary" />
          <h3 className="text-xl font-bold">
            {t.hero?.calculator?.title || "Income Calculator"}
          </h3>
        </div>

        <div className="space-y-6">
          <div>
            <div className="flex justify-between mb-2">
              <label className="text-sm text-muted-foreground">
                {t.hero?.calculator?.subscribers || "Subscribers"}
              </label>
              <span className="text-sm font-semibold text-primary">{subscribers}</span>
            </div>
            <Slider
              value={[subscribers]}
              onValueChange={(value) => setSubscribers(value[0])}
              min={10}
              max={1000}
              step={10}
              className="w-full"
            />
          </div>

          <div>
            <div className="flex justify-between mb-2">
              <label className="text-sm text-muted-foreground">
                {t.hero?.calculator?.price || "Price per subscription ($)"}
              </label>
              <span className="text-sm font-semibold text-primary">${pricePerSub}</span>
            </div>
            <Slider
              value={[pricePerSub]}
              onValueChange={(value) => setPricePerSub(value[0])}
              min={5}
              max={50}
              step={1}
              className="w-full"
            />
          </div>

          <div className="pt-4 border-t border-border/50 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">
                {t.hero?.calculator?.monthly || "Monthly Revenue"}
              </span>
              <span className="text-lg font-bold">${monthlyIncome.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">
                {t.hero?.calculator?.commission || "Agency Fee (20%)"}
              </span>
              <span className="text-sm text-muted-foreground">-${agencyTake.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center pt-3 border-t border-primary/20">
              <span className="font-semibold text-primary">
                {t.hero?.calculator?.yourIncome || "Your Monthly Income"}
              </span>
              <span className="text-2xl font-bold text-primary">${yourIncome.toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <TrendingUp className="w-4 h-4" />
              <span>
                {t.hero?.calculator?.yearly || "Yearly"}: <span className="font-semibold text-foreground">${yearlyIncome.toLocaleString()}</span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default IncomeCalculator;
