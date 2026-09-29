import React, { useState, useEffect, useCallback, useRef } from 'react';
import { TILE_SIZE, generateDefaultHighlights } from './gridConfig';
import { GridTile } from './GridTile';

export const TileGridBackground: React.FC = () => {
  // Safe initial default dimensions before mount
  const [gridSize, setGridSize] = useState({
    cols: typeof window !== 'undefined' ? Math.max(10, Math.ceil(window.innerWidth / TILE_SIZE)) : 40,
    rows: typeof window !== 'undefined' ? Math.max(8, Math.ceil(window.innerHeight / TILE_SIZE)) : 28,
  });

  // Track active (purple) tiles
  const [activeTiles, setActiveTiles] = useState<Set<string>>(() =>
    generateDefaultHighlights(gridSize.rows, gridSize.cols)
  );

  // Track glowing tiles for temporary glow effect
  const [glowingTiles, setGlowingTiles] = useState<Set<string>>(new Set());
  const timeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // Cleanup timeouts on unmount
  useEffect(() => {
    const timeouts = timeoutsRef.current;
    return () => {
      timeouts.forEach((t) => clearTimeout(t));
      timeouts.clear();
    };
  }, []);

  // Update grid on resize
  useEffect(() => {
    const handleResize = () => {
      const newCols = Math.max(10, Math.ceil(window.innerWidth / TILE_SIZE));
      const newRows = Math.max(8, Math.ceil(window.innerHeight / TILE_SIZE));

      setGridSize((prev) => {
        if (prev.cols !== newCols || prev.rows !== newRows) {
          setActiveTiles(generateDefaultHighlights(newRows, newCols));
          return { cols: newCols, rows: newRows };
        }
        return prev;
      });
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Toggle tile state on click with smooth animation and temporary glow
  const handleToggle = useCallback((r: number, c: number) => {
    const key = `${r},${c}`;

    // 1. Toggle highlight
    setActiveTiles((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });

    // 2. Trigger temporary glow
    setGlowingTiles((prev) => new Set(prev).add(key));

    if (timeoutsRef.current.has(key)) {
      clearTimeout(timeoutsRef.current.get(key)!);
    }

    const timer = setTimeout(() => {
      setGlowingTiles((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
      timeoutsRef.current.delete(key);
    }, 550);

    timeoutsRef.current.set(key, timer);
  }, []);

  return (
    <div
      className="absolute inset-0 w-full h-full grid"
      style={{
        gridTemplateColumns: `repeat(${gridSize.cols}, 1fr)`,
        gridTemplateRows: `repeat(${gridSize.rows}, 1fr)`,
      }}
    >
      {Array.from({ length: gridSize.rows }).map((_, r) =>
        Array.from({ length: gridSize.cols }).map((_, c) => {
          const key = `${r},${c}`;
          return (
            <GridTile
              key={key}
              row={r}
              col={c}
              isHighlighted={activeTiles.has(key)}
              isGlowing={glowingTiles.has(key)}
              onToggle={handleToggle}
            />
          );
        })
      )}
    </div>
  );
};

export default TileGridBackground;
