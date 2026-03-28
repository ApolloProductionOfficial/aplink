"use client";
import { useState, useEffect, useRef } from "react";
import { ArrowRight, Link, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface TimelineItem {
  id: number;
  title: string;
  date: string;
  content: string;
  category: string;
  icon: React.ElementType;
  relatedIds: number[];
  status: "completed" | "in-progress" | "pending";
  energy: number;
}

interface RadialOrbitalTimelineProps {
  timelineData: TimelineItem[];
}

export default function RadialOrbitalTimeline({
  timelineData,
}: RadialOrbitalTimelineProps) {
  const [expandedItems, setExpandedItems] = useState<Record<number, boolean>>(
    {}
  );
  const [rotationAngle, setRotationAngle] = useState(0);
  const [autoRotate, setAutoRotate] = useState(true);
  const [pulseEffect, setPulseEffect] = useState<Record<number, boolean>>({});
  const [centerOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [activeNodeId, setActiveNodeId] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const orbitRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef<Record<number, HTMLDivElement | null>>({});

  const handleContainerClick = (e: React.MouseEvent) => {
    if (e.target === containerRef.current || e.target === orbitRef.current) {
      setExpandedItems({});
      setActiveNodeId(null);
      setPulseEffect({});
      setAutoRotate(true);
    }
  };

  const toggleItem = (id: number) => {
    setExpandedItems((prev) => {
      const newState = { ...prev };
      Object.keys(newState).forEach((key) => {
        if (parseInt(key) !== id) {
          newState[parseInt(key)] = false;
        }
      });

      newState[id] = !prev[id];

      if (!prev[id]) {
        setActiveNodeId(id);
        setAutoRotate(false);

        const relatedItems = getRelatedItems(id);
        const newPulseEffect: Record<number, boolean> = {};
        relatedItems.forEach((relId) => {
          newPulseEffect[relId] = true;
        });
        setPulseEffect(newPulseEffect);

        centerViewOnNode(id);
      } else {
        setActiveNodeId(null);
        setAutoRotate(true);
        setPulseEffect({});
      }

      return newState;
    });
  };

  useEffect(() => {
    let rotationTimer: NodeJS.Timeout;

    if (autoRotate) {
      rotationTimer = setInterval(() => {
        setRotationAngle((prev) => {
          const newAngle = (prev + 0.3) % 360;
          return Number(newAngle.toFixed(3));
        });
      }, 50);
    }

    return () => {
      if (rotationTimer) {
        clearInterval(rotationTimer);
      }
    };
  }, [autoRotate]);

  const centerViewOnNode = (nodeId: number) => {
    const nodeIndex = timelineData.findIndex((item) => item.id === nodeId);
    const totalNodes = timelineData.length;
    const targetAngle = (nodeIndex / totalNodes) * 360;
    setRotationAngle(270 - targetAngle);
  };

  const calculateNodePosition = (index: number, total: number) => {
    const angle = ((index / total) * 360 + rotationAngle) % 360;
    const radius = 200;
    const radian = (angle * Math.PI) / 180;

    const x = radius * Math.cos(radian) + centerOffset.x;
    const y = radius * Math.sin(radian) + centerOffset.y;

    const zIndex = Math.round(100 + 50 * Math.cos(radian));
    const opacity = Math.max(
      0.4,
      Math.min(1, 0.4 + 0.6 * ((1 + Math.sin(radian)) / 2))
    );

    return { x, y, angle, zIndex, opacity };
  };

  const getRelatedItems = (itemId: number): number[] => {
    const currentItem = timelineData.find((item) => item.id === itemId);
    return currentItem ? currentItem.relatedIds : [];
  };

  const isRelatedToActive = (itemId: number): boolean => {
    if (!activeNodeId) return false;
    const relatedItems = getRelatedItems(activeNodeId);
    return relatedItems.includes(itemId);
  };

  const getStatusStyles = (status: TimelineItem["status"]): string => {
    switch (status) {
      case "completed":
        return "text-primary-foreground bg-primary border-primary/50";
      case "in-progress":
        return "text-foreground bg-foreground/10 border-foreground/30";
      case "pending":
        return "text-muted-foreground bg-muted border-border";
      default:
        return "text-muted-foreground bg-muted border-border";
    }
  };

  const getStatusNodeStyles = (status: TimelineItem["status"]): string => {
    switch (status) {
      case "completed":
        return "border-primary/60 bg-primary/20 shadow-[0_0_15px_hsl(var(--primary)/0.3)]";
      case "in-progress":
        return "border-foreground/40 bg-foreground/10 shadow-[0_0_15px_hsl(var(--foreground)/0.15)]";
      case "pending":
        return "border-border bg-muted/50";
      default:
        return "border-border bg-muted/50";
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full flex items-center justify-center overflow-hidden"
      style={{ minHeight: "550px" }}
      onClick={handleContainerClick}
    >
      <div
        ref={orbitRef}
        className="relative"
        style={{ width: "500px", height: "500px" }}
      >
        {/* Center hub */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
          <div className="relative">
            <div className="absolute -inset-4 rounded-full bg-primary/20 blur-xl animate-pulse" />
            <div className="relative w-20 h-20 rounded-full glass border-2 border-primary/40 flex items-center justify-center shadow-[0_0_30px_hsl(var(--primary)/0.3)]">
              <Zap className="w-8 h-8 text-primary" />
            </div>
          </div>
        </div>

        {/* Orbit rings */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
          <div className="w-[400px] h-[400px] rounded-full border border-border/30 absolute -translate-x-1/2 -translate-y-1/2" />
          <div className="w-[300px] h-[300px] rounded-full border border-border/20 absolute -translate-x-1/2 -translate-y-1/2" />
          <div className="w-[200px] h-[200px] rounded-full border border-border/10 absolute -translate-x-1/2 -translate-y-1/2" />
        </div>

        {/* Nodes */}
        {timelineData.map((item, index) => {
          const position = calculateNodePosition(index, timelineData.length);
          const isExpanded = expandedItems[item.id];
          const isRelated = isRelatedToActive(item.id);
          const isPulsing = pulseEffect[item.id];
          const Icon = item.icon;

          const nodeStyle: React.CSSProperties = {
            transform: `translate(${position.x}px, ${position.y}px)`,
            zIndex: isExpanded ? 200 : position.zIndex,
            opacity: isExpanded ? 1 : position.opacity,
          };

          return (
            <div
              key={item.id}
              ref={(el) => (nodeRefs.current[item.id] = el)}
              className="absolute top-1/2 left-1/2 transition-all duration-700"
              style={nodeStyle}
              onClick={(e) => {
                e.stopPropagation();
                toggleItem(item.id);
              }}
            >
              {/* Pulse ring for related nodes */}
              {isPulsing && (
                <div className="absolute -inset-3 rounded-full border-2 border-primary/50 animate-ping" />
              )}

              {/* Node circle */}
              <div
                className={`relative -translate-x-1/2 -translate-y-1/2 w-14 h-14 rounded-full border-2 flex items-center justify-center cursor-pointer transition-all duration-300 hover:scale-125 ${getStatusNodeStyles(item.status)} ${
                  isRelated ? "scale-125 ring-2 ring-primary/40" : ""
                }`}
              >
                <Icon className="w-6 h-6 text-primary" />
              </div>

              {/* Label */}
              <div className="absolute top-8 left-1/2 -translate-x-1/2 whitespace-nowrap">
                <span className="text-xs font-medium text-foreground/80 bg-background/60 backdrop-blur-sm px-2 py-0.5 rounded-full border border-border/30">
                  {item.title}
                </span>
              </div>

              {/* Expanded card */}
              {isExpanded && (
                <div className="absolute top-10 left-1/2 -translate-x-1/2 w-72 z-50">
                  <Card className="glass-dark border-primary/30 shadow-[0_0_40px_hsl(var(--primary)/0.2)]">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between mb-1">
                        <Badge className={getStatusStyles(item.status)}>
                          {item.status === "completed"
                            ? "ГОТОВО"
                            : item.status === "in-progress"
                            ? "В РАБОТЕ"
                            : "ПЛАНЫ"}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {item.date}
                        </span>
                      </div>
                      <CardTitle className="text-base text-foreground">
                        {item.title}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <p className="text-sm text-muted-foreground mb-3">
                        {item.content}
                      </p>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="flex items-center gap-1 text-muted-foreground">
                            <Zap className="w-3 h-3 text-primary" />
                            Прогресс
                          </span>
                          <span className="text-foreground font-medium">{item.energy}%</span>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-primary to-primary/60 transition-all duration-700"
                            style={{ width: `${item.energy}%` }}
                          />
                        </div>
                      </div>

                      {item.relatedIds.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-border/30">
                          <div className="flex items-center gap-1 mb-2">
                            <Link className="w-3 h-3 text-primary" />
                            <span className="text-xs text-muted-foreground">
                              Связанные этапы
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {item.relatedIds.map((relatedId) => {
                              const relatedItem = timelineData.find(
                                (i) => i.id === relatedId
                              );
                              return (
                                <Button
                                  key={relatedId}
                                  variant="outline"
                                  size="sm"
                                  className="h-6 text-xs px-2 border-primary/30 hover:bg-primary/10 hover:border-primary/50"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleItem(relatedId);
                                  }}
                                >
                                  {relatedItem?.title}
                                  <ArrowRight className="w-3 h-3 ml-1" />
                                </Button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
