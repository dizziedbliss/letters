// Grid configuration constants and helper functions

export const TILE_SIZE = 36;
export const BORDER_COLOR = 'rgba(0, 0, 0, 0.20)'; // 20% opacity border
export const ACTIVE_COLOR = '#6100D8'; // Purple
export const INACTIVE_COLOR = '#ffffff'; // White

/**
 * Generate initial highlighted tiles based on the screen's row and column counts.
 * Matches the design aesthetic: pixelated clusters around edges and corners.
 */
export function generateDefaultHighlights(rows: number, cols: number): Set<string> {
  const highlights = new Set<string>();

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const distFromTop = r;
      const distFromBottom = rows - 1 - r;
      const distFromLeft = c;
      const distFromRight = cols - 1 - c;
      const edgeDist = Math.min(distFromTop, distFromBottom, distFromLeft, distFromRight);

      // 1. Corners: Top-Left, Top-Right, Bottom-Left, Bottom-Right
      const isTopLeft = r <= 3 && c <= 4;
      const isTopRight = r <= 3 && c >= cols - 5;
      const isBottomLeft = r >= rows - 4 && c <= 4;
      const isBottomRight = r >= rows - 4 && c >= cols - 5;

      if (isTopLeft) {
        if ((r === 0 && c <= 4) || (r === 1 && c <= 2) || (r === 2 && c === 0) || (r === 1 && c === 4)) {
          highlights.add(`${r},${c}`);
        }
      } else if (isTopRight) {
        if ((r === 0 && c >= cols - 3) || (r === 1 && c >= cols - 2) || (r === 2 && c === cols - 1) || (r === 0 && c === cols - 5)) {
          highlights.add(`${r},${c}`);
        }
      } else if (isBottomLeft) {
        if ((r === rows - 1 && c <= 2) || (r === rows - 2 && c <= 1) || (r === rows - 3 && c === 0) || (r === rows - 1 && c === 4)) {
          highlights.add(`${r},${c}`);
        }
      } else if (isBottomRight) {
        if ((r === rows - 1 && c >= cols - 4) || (r === rows - 2 && c >= cols - 3) || (r === rows - 3 && c === cols - 1)) {
          highlights.add(`${r},${c}`);
        }
      } else if (edgeDist === 0) {
        // Outer perimeter scattered highlights
        if ((r * 7 + c * 13 + 5) % 5 === 0 || (r * 11 + c * 3) % 7 === 0) {
          highlights.add(`${r},${c}`);
        }
      } else if (edgeDist === 1) {
        // Secondary perimeter accent highlights
        if ((r * 13 + c * 17 + 2) % 9 === 0) {
          highlights.add(`${r},${c}`);
        }
      }
    }
  }

  return highlights;
}
