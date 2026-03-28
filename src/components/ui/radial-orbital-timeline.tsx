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

interface TimelineLabels {
  statusDone?: string;
  statusInProgress?: string;
  statusPending?: string;
  progress?: string;
  relatedStages?: string;
}

interface RadialOrbitalTimelineProps {
  timelineData: TimelineItem[];
  labels?: TimelineLabels;
}

export default function RadialOrbitalTimeline({
  timelineData,
  labels = {},
}: RadialOrbitalTimelineProps) {
  const [expandedItems, setExpandedItems] = useState<Record<number, boolean>>({});
  const [rotationAngle, setRotationAngle] = useState(0);
  const [autoRotate, setAutoRotate] = useState(true);
  const [pulseEffect, setPulseEffect] = useState<Record<number, boolean>>({});
  const [centerOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [activeNodeId, setActiveNodeId] = useState<number | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const orbitRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef<Record<number, HTMLDivElement | null>>({});

  // Responsive detection
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const radius = isMobile ? 110 : 200;
  const containerSize = isMobile ? 300 : 500;
  const nodeSize = isMobile ? 40 : 56;
  const iconSize = isMobile ? 16 : 24;
  const cardWidth = isMobile ? 220 : 288;

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
        if (parseInt(key) !== id) newState[parseInt(key)] = false;
      });
      newState[id] = !prev[id];
      if (!prev[id]) {
        setActiveNodeId(id);
        setAutoRotate(false);
        const relatedItems = getRelatedItems(id);
        const newPulse: Record<number, boolean> = {};
        relatedItems.forEach((relId) => { newPulse[relId] = true; });
        setPulseEffect(newPulse);
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
        setRotationAngle((prev) => Number(((prev + 0.3) % 360).toFixed(3)));
      }, 50);
    }
    return () => { if (rotationTimer) clearInterval(rotationTimer); };
  }, [autoRotate]);

  const centerViewOnNode = (nodeId: number) => {
    const nodeIndex = timelineData.findIndex((item) => item.id === nodeId);
    const totalNodes = timelineData.length;
    const targetAngle = (nodeIndex / totalNodes) * 360;
    setRotationAngle(270 - targetAngle);
  };

  const calculateNodePosition = (index: number, total: number) => {
    const angle = ((index / total) * 360 + rotationAngle) % 360;
    const radian = (angle * Math.PI) / 180;
    const x = radius * Math.cos(radian) + centerOffset.x;
    const y = radius * Math.sin(radian) + centerOffset.y;
    const zIndex = Math.round(100 + 50 * Math.cos(radian));
    const opacity = Math.max(0.4, Math.min(1, 0.4 + 0.6 * ((1 + Math.sin(radian)) / 2)));
    return { x, y, angle, zIndex, opacity };
  };

  const getRelatedItems = (itemId: number): number[] => {
    const currentItem = timelineData.find((item) => item.id === itemId);
    return currentItem ? currentItem.relatedIds : [];
  };

  const isRelatedToActive = (itemId: number): boolean => {
    if (!activeNodeId) return false;
    return getRelatedItems(activeNodeId).includes(itemId);
  };

  const getStatusStyles = (status: TimelineItem["status"]): string => {
    switch (status) {
      case "completed": return "text-primary-foreground bg-primary border-primary/50";
      case "in-progress": return "text-foreground bg-foreground/10 border-foreground/30";
      case "pending": return "text-muted-foreground bg-muted border-border";
      default: return "text-muted-foreground bg-muted border-border";
    }
  };

  const getStatusNodeStyles = (status: TimelineItem["status"]): string => {
    switch (status) {
      case "completed": return "border-primary/60 bg-primary/20 shadow-[0_0_15px_hsl(var(--primary)/0.3)]";
      case "in-progress": return "border-foreground/40 bg-foreground/10 shadow-[0_0_15px_hsl(var(--foreground)/0.15)]";
      case "pending": return "border-border bg-muted/50";
      default: return "border-border bg-muted/50";
    }
  };

  const getStatusLabel = (status: TimelineItem["status"]): string => {
    switch (status) {
      case "completed": return labels.statusDone || "ГОТОВО";
      case "in-progress": return labels.statusInProgress || "В РАБОТЕ";
      case "pending": return labels.statusPending || "ПЛАНЫ";
      default: return labels.statusPending || "ПЛАНЫ";
    }
  };

  const orbitRingSizes = isMobile
    ? [{ w: 220, o: 0.3 }, { w: 165, o: 0.2 }, { w: 110, o: 0.1 }]
    : [{ w: 400, o: 0.3 }, { w: 300, o: 0.2 }, { w: 200, o: 0.1 }];

  const hubSize = isMobile ? 48 : 80;
  const hubIconSize = isMobile ? 20 : 32;

  return (
    <div
      ref={containerRef}
      className="relative w-full flex items-center justify-center overflow-hidden"
      style={{ minHeight: isMobile ? "380px" : "550px" }}
      onClick={handleContainerClick}
    >
      <div
        ref={orbitRef}
        className="relative"
        style={{ width: `${containerSize}px`, height: `${containerSize}px` }}
      >
        {/* Center hub */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
          <div className="relative">
            <div className="absolute -inset-3 rounded-full bg-primary/20 blur-xl animate-pulse" />
            <div
              className="relative rounded-full glass border-2 border-primary/40 flex items-center justify-center shadow-[0_0_30px_hsl(var(--primary)/0.3)]"
              style={{ width: hubSize, height: hubSize }}
            >
              <Zap style={{ width: hubIconSize, height: hubIconSize }} className="text-primary" />
            </div>
          </div>
        </div>

        {/* Orbit rings */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
          {orbitRingSizes.map((ring, i) => (
            <div
              key={i}
              className="rounded-full border absolute -translate-x-1/2 -translate-y-1/2"
              style={{ width: ring.w, height: ring.w, borderColor: `hsl(var(--border) / ${ring.o})` }}
            />
          ))}
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
              {isPulsing && (
                <div className="absolute -inset-3 rounded-full border-2 border-primary/50 animate-ping" />
              )}

              <div
                className={`relative -translate-x-1/2 -translate-y-1/2 rounded-full border-2 flex items-center justify-center cursor-pointer transition-all duration-300 hover:scale-125 ${getStatusNodeStyles(item.status)} ${isRelated ? "scale-125 ring-2 ring-primary/40" : ""}`}
                style={{ width: nodeSize, height: nodeSize }}
              >
                <Icon style={{ width: iconSize, height: iconSize }} className="text-primary" />
              </div>

              <div className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap" style={{ top: nodeSize * 0.55 }}>
                <span className={`font-medium text-foreground/80 bg-background/60 backdrop-blur-sm px-2 py-0.5 rounded-full border border-border/30 ${isMobile ? 'text-[10px]' : 'text-xs'}`}>
                  {item.title}
                </span>
              </div>

              {isExpanded && (
                <div className="absolute left-1/2 -translate-x-1/2 z-50" style={{ top: nodeSize * 0.7, width: cardWidth }}>
                  <Card className="glass-dark border-primary/30 shadow-[0_0_40px_hsl(var(--primary)/0.2)]">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between mb-1">
                        <Badge className={getStatusStyles(item.status)}>
                          {getStatusLabel(item.status)}
                        </Badge>
                        <span className="text-xs text-muted-foreground">{item.date}</span>
                      </div>
                      <CardTitle className={`text-foreground ${isMobile ? 'text-sm' : 'text-base'}`}>
                        {item.title}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <p className={`text-muted-foreground mb-3 ${isMobile ? 'text-xs' : 'text-sm'}`}>
                        {item.content}
                      </p>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="flex items-center gap-1 text-muted-foreground">
                            <Zap className="w-3 h-3 text-primary" />
                            {labels.progress || "Прогресс"}
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
                              {labels.relatedStages || "Связанные этапы"}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {item.relatedIds.map((relatedId) => {
                              const relatedItem = timelineData.find((i) => i.id === relatedId);
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
