import { useState, useRef, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { ZoomIn, ZoomOut, Move, Check, X } from 'lucide-react';

interface AvatarCropDialogProps {
  open: boolean;
  imageFile: File | null;
  onClose: () => void;
  onSave: (croppedBlob: Blob) => void;
}

export function AvatarCropDialog({ open, imageFile, onClose, onSave }: AvatarCropDialogProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [imageLoaded, setImageLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  const CANVAS_SIZE = 280;
  const OUTPUT_SIZE = 256;

  // Load image when file changes
  useEffect(() => {
    if (!imageFile || !open) return;

    const img = new Image();
    img.onload = () => {
      imageRef.current = img;
      setImageLoaded(true);
      // Center image
      setPosition({ x: 0, y: 0 });
      setZoom(1);
    };
    img.src = URL.createObjectURL(imageFile);

    return () => {
      if (img.src) URL.revokeObjectURL(img.src);
    };
  }, [imageFile, open]);

  // Draw image on canvas
  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    const img = imageRef.current;
    
    if (!canvas || !ctx || !img) return;

    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    // Calculate dimensions to fit image in canvas
    const aspectRatio = img.width / img.height;
    let drawWidth, drawHeight;

    if (aspectRatio > 1) {
      drawHeight = CANVAS_SIZE * zoom;
      drawWidth = drawHeight * aspectRatio;
    } else {
      drawWidth = CANVAS_SIZE * zoom;
      drawHeight = drawWidth / aspectRatio;
    }

    const x = (CANVAS_SIZE - drawWidth) / 2 + position.x;
    const y = (CANVAS_SIZE - drawHeight) / 2 + position.y;

    ctx.drawImage(img, x, y, drawWidth, drawHeight);
  }, [zoom, position]);

  useEffect(() => {
    if (imageLoaded) {
      drawCanvas();
    }
  }, [imageLoaded, drawCanvas]);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    setIsDragging(true);
    setDragStart({ x: touch.clientX - position.x, y: touch.clientY - position.y });
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    const touch = e.touches[0];
    setPosition({
      x: touch.clientX - dragStart.x,
      y: touch.clientY - dragStart.y,
    });
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  const handleSave = async () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    const img = imageRef.current;
    
    if (!canvas || !ctx || !img) return;

    setSaving(true);

    try {
      // Create output canvas with final size
      const outputCanvas = document.createElement('canvas');
      outputCanvas.width = OUTPUT_SIZE;
      outputCanvas.height = OUTPUT_SIZE;
      const outputCtx = outputCanvas.getContext('2d');
      
      if (!outputCtx) return;

      // Draw circular clip
      outputCtx.beginPath();
      outputCtx.arc(OUTPUT_SIZE / 2, OUTPUT_SIZE / 2, OUTPUT_SIZE / 2, 0, Math.PI * 2);
      outputCtx.closePath();
      outputCtx.clip();

      // Scale factor between display and output
      const scale = OUTPUT_SIZE / CANVAS_SIZE;

      // Calculate dimensions
      const aspectRatio = img.width / img.height;
      let drawWidth, drawHeight;

      if (aspectRatio > 1) {
        drawHeight = OUTPUT_SIZE * zoom;
        drawWidth = drawHeight * aspectRatio;
      } else {
        drawWidth = OUTPUT_SIZE * zoom;
        drawHeight = drawWidth / aspectRatio;
      }

      const x = (OUTPUT_SIZE - drawWidth) / 2 + position.x * scale;
      const y = (OUTPUT_SIZE - drawHeight) / 2 + position.y * scale;

      outputCtx.drawImage(img, x, y, drawWidth, drawHeight);

      // Convert to blob
      outputCanvas.toBlob(
        (blob) => {
          if (blob) {
            onSave(blob);
          }
          setSaving(false);
        },
        'image/jpeg',
        0.9
      );
    } catch (error) {
      console.error('Error cropping image:', error);
      setSaving(false);
    }
  };

  const handleClose = () => {
    setImageLoaded(false);
    setZoom(1);
    setPosition({ x: 0, y: 0 });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Move className="w-5 h-5" />
            Настройка аватара
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4 py-4">
          {/* Canvas container with circular mask */}
          <div
            ref={containerRef}
            className="relative rounded-full overflow-hidden cursor-move border-4 border-primary/30 shadow-lg"
            style={{ width: CANVAS_SIZE, height: CANVAS_SIZE }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            <canvas
              ref={canvasRef}
              width={CANVAS_SIZE}
              height={CANVAS_SIZE}
              className="block"
            />
            
            {/* Overlay grid for positioning help */}
            <div className="absolute inset-0 pointer-events-none">
              <div className="w-full h-full border-2 border-dashed border-white/20 rounded-full" />
              <div className="absolute top-1/2 left-0 right-0 h-px bg-white/10" />
              <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white/10" />
            </div>
          </div>

          <p className="text-sm text-muted-foreground text-center">
            Перетащите для позиционирования
          </p>

          {/* Zoom controls */}
          <div className="flex items-center gap-3 w-full max-w-xs">
            <ZoomOut className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <Slider
              value={[zoom]}
              min={0.5}
              max={3}
              step={0.1}
              onValueChange={([value]) => setZoom(value)}
              className="flex-1"
            />
            <ZoomIn className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          </div>

          <p className="text-xs text-muted-foreground">
            Масштаб: {Math.round(zoom * 100)}%
          </p>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleClose} disabled={saving}>
            <X className="w-4 h-4 mr-2" />
            Отмена
          </Button>
          <Button onClick={handleSave} disabled={saving || !imageLoaded}>
            {saving ? (
              <div className="w-4 h-4 mr-2 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : (
              <Check className="w-4 h-4 mr-2" />
            )}
            Сохранить
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
