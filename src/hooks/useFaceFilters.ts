import { useRef, useCallback, useState, useEffect } from 'react';

export type FilterType = 'none' | 'beauty' | 'glow' | 'warm' | 'cool' | 'vintage';

interface FilterConfig {
  id: FilterType;
  label: string;
  cssFilter: string;
}

export const FACE_FILTERS: FilterConfig[] = [
  { id: 'none', label: 'Без фильтра', cssFilter: 'none' },
  { id: 'beauty', label: 'Красота', cssFilter: 'blur(0.3px) brightness(1.08) contrast(0.95) saturate(1.05)' },
  { id: 'glow', label: 'Сияние', cssFilter: 'brightness(1.15) contrast(0.9) saturate(1.1)' },
  { id: 'warm', label: 'Тёплый', cssFilter: 'sepia(0.15) saturate(1.2) brightness(1.05)' },
  { id: 'cool', label: 'Холодный', cssFilter: 'hue-rotate(-10deg) saturate(1.1) brightness(1.05)' },
  { id: 'vintage', label: 'Винтаж', cssFilter: 'sepia(0.3) contrast(1.1) brightness(0.95) saturate(0.85)' },
];

export const useFaceFilters = () => {
  const [activeFilter, setActiveFilter] = useState<FilterType>('none');
  const styleTagRef = useRef<HTMLStyleElement | null>(null);

  // Apply filter by injecting CSS
  const applyFilter = useCallback((filterId: FilterType) => {
    setActiveFilter(filterId);
    
    const filter = FACE_FILTERS.find(f => f.id === filterId);
    if (!filter) return;

    // Create or update style tag
    if (!styleTagRef.current) {
      styleTagRef.current = document.createElement('style');
      styleTagRef.current.id = 'face-filter-styles';
      document.head.appendChild(styleTagRef.current);
    }

    if (filterId === 'none') {
      styleTagRef.current.textContent = '';
    } else {
      // Apply filter to local video in the self-view and participant tiles
      styleTagRef.current.textContent = `
        .livekit-room-container .lk-participant-tile video,
        .livekit-room-container .mirror {
          filter: ${filter.cssFilter} !important;
        }
      `;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (styleTagRef.current) {
        styleTagRef.current.remove();
        styleTagRef.current = null;
      }
    };
  }, []);

  const removeFilter = useCallback(() => {
    applyFilter('none');
  }, [applyFilter]);

  return { 
    activeFilter, 
    setActiveFilter: applyFilter, 
    removeFilter,
    filters: FACE_FILTERS,
  };
};

export default useFaceFilters;
