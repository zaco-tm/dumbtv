import React from 'react';
import type {LayoutChangeEvent} from 'react-native';

/**
 * A grid of equal columns, the way a CSS grid makes them.
 *
 * The prototype's grids are `grid-cols-6`, so the columns are equal and they share
 * the width the container actually has — not a width worked out in advance. A grid
 * that assumed the stage's width would put six tiles in the wrong place on any
 * screen that is not exactly the stage's shape.
 *
 * So the container is measured, and the column width comes from the measurement.
 */
export function useGridColumns(columns: number, gap: number): {
  /** The width of one column, or 0 before the container has been measured. */
  columnWidth: number;
  /** The handler to put on the container. */
  onLayout: (event: LayoutChangeEvent) => void;
} {
  const [width, setWidth] = React.useState(0);

  const onLayout = React.useCallback((event: LayoutChangeEvent) => {
    setWidth(event.nativeEvent.layout.width);
  }, []);

  const columnWidth = width > 0 ? (width - gap * (columns - 1)) / columns : 0;

  return {columnWidth, onLayout};
}
