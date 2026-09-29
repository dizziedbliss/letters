import React, { memo } from 'react';
import { BORDER_COLOR, ACTIVE_COLOR, INACTIVE_COLOR } from './gridConfig';

interface GridTileProps {
  row: number;
  col: number;
  isHighlighted: boolean;
  isGlowing: boolean;
  onToggle: (row: number, col: number) => void;
}

export const GridTile: React.FC<GridTileProps> = memo(({
  row,
  col,
  isHighlighted,
  isGlowing,
  onToggle,
}) => {
  return (
    <button
      type="button"
      onClick={() => onToggle(row, col)}
      aria-label={`Toggle tile at row ${row}, column ${col}`}
      style={{
        backgroundColor: isHighlighted ? ACTIVE_COLOR : INACTIVE_COLOR,
        border: `0.5px solid ${BORDER_COLOR}`,
        boxSizing: 'border-box',
        margin: 0,
        padding: 0,
        width: '100%',
        height: '100%',
        minWidth: 0,
        minHeight: 0,
        cursor: 'pointer',
        outline: 'none',
        touchAction: 'manipulation',
        WebkitTapHighlightColor: 'transparent',
        transform: isGlowing ? 'scale(1.12)' : 'scale(1)',
        zIndex: isGlowing ? 20 : 1,
        boxShadow: isGlowing
          ? isHighlighted
            ? '0 0 16px 3px rgba(97, 0, 216, 0.85), inset 0 0 8px rgba(255, 255, 255, 0.6)'
            : '0 0 14px 3px rgba(0, 216, 255, 0.75), inset 0 0 6px rgba(0, 216, 255, 0.3)'
          : 'none',
        transition:
          'background-color 0.25s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.4s cubic-bezier(0.4, 0, 0.2, 1), transform 0.1s cubic-bezier(0.34, 1.56, 0.64, 1)',
      }}
      className={`active:scale-90 active:transition-none ${
        isHighlighted
          ? 'hover:brightness-110'
          : 'hover:bg-[#6100D8]/15'
      }`}
    />
  );
});

GridTile.displayName = 'GridTile';

export default GridTile;
