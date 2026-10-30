import React from 'react';
import Svg, {Circle, Line, Path, Rect} from 'react-native-svg';

/**
 * The icons, as the prototype's lucide ones are drawn.
 *
 * The paths are lucide 1.64.0's own — the version the prototype uses — copied here so
 * the app does not depend on a package the prototype happens to have. The rail's icons
 * are the ones the prototype's rail uses; `plug` is the socket the Favorites row draws
 * for an input, and `star` is the rating's data.
 *
 * Lucide draws in a 24-unit box with a stroke and no fill, so the app does the same.
 */

/** One node of an icon: a path, a rectangle, a line or a circle. */
type IconNode =
  | {tag: 'path'; d: string}
  | {tag: 'rect'; x: number; y: number; width: number; height: number; rx: number}
  | {tag: 'line'; x1: number; y1: number; x2: number; y2: number}
  | {tag: 'circle'; cx: number; cy: number; r: number};

/** The icon set. */
export type IconName =
  | 'house'
  | 'tv'
  | 'play'
  | 'gamepad-2'
  | 'cable'
  | 'baby'
  | 'settings'
  | 'star'
  | 'plug';

const ICONS: Record<IconName, IconNode[]> = {
  house: [
    {tag: 'path', d: 'M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8'},
    {
      tag: 'path',
      d: 'M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
    },
  ],
  tv: [
    {tag: 'path', d: 'm17 2-5 5-5-5'},
    {tag: 'rect', x: 2, y: 7, width: 20, height: 15, rx: 2},
  ],
  play: [
    {
      tag: 'path',
      d: 'M5 5a2 2 0 0 1 3.008-1.728l11.997 6.998a2 2 0 0 1 .003 3.458l-12 7A2 2 0 0 1 5 19z',
    },
  ],
  'gamepad-2': [
    {tag: 'line', x1: 6, y1: 11, x2: 10, y2: 11},
    {tag: 'line', x1: 8, y1: 9, x2: 8, y2: 13},
    {tag: 'line', x1: 15, y1: 12, x2: 15.01, y2: 12},
    {tag: 'line', x1: 18, y1: 10, x2: 18.01, y2: 10},
    {
      tag: 'path',
      d: 'M17.32 5H6.68a4 4 0 0 0-3.978 3.59c-.006.052-.01.101-.017.152C2.604 9.416 2 14.456 2 16a3 3 0 0 0 3 3c1 0 1.5-.5 2-1l1.414-1.414A2 2 0 0 1 9.828 16h4.344a2 2 0 0 1 1.414.586L17 18c.5.5 1 1 2 1a3 3 0 0 0 3-3c0-1.545-.604-6.584-.685-7.258-.007-.05-.011-.1-.017-.151A4 4 0 0 0 17.32 5z',
    },
  ],
  cable: [
    {tag: 'path', d: 'M17 19a1 1 0 0 1-1-1v-2a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2a1 1 0 0 1-1 1z'},
    {tag: 'path', d: 'M17 21v-2'},
    {tag: 'path', d: 'M19 14V6.5a2 2 0 0 0-7 0v11a2 2 0 0 1-7 0V10'},
    {tag: 'path', d: 'M21 21v-2'},
    {tag: 'path', d: 'M3 5V3'},
    {tag: 'path', d: 'M4 10a2 2 0 0 1-2-2V6a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2a2 2 0 0 1-2 2z'},
    {tag: 'path', d: 'M7 5V3'},
  ],
  baby: [
    {tag: 'path', d: 'M10 16c.5.3 1.2.5 2 .5s1.5-.2 2-.5'},
    {tag: 'path', d: 'M15 12h.01'},
    {
      tag: 'path',
      d: 'M19.38 6.813A9 9 0 0 1 20.8 10.2a2 2 0 0 1 0 3.6 9 9 0 0 1-17.6 0 2 2 0 0 1 0-3.6A9 9 0 0 1 12 3c2 0 3.5 1.1 3.5 2.5s-.9 2.5-2 2.5c-.8 0-1.5-.4-1.5-1',
    },
    {tag: 'path', d: 'M9 12h.01'},
  ],
  settings: [
    {
      tag: 'path',
      d: 'M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915',
    },
    {tag: 'circle', cx: 12, cy: 12, r: 3},
  ],
  star: [
    {
      tag: 'path',
      d: 'M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.123 2.123 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.123 2.123 0 0 0 1.597-1.16z',
    },
  ],
  plug: [
    {tag: 'path', d: 'M12 22v-5'},
    {tag: 'path', d: 'M15 8V2'},
    {tag: 'path', d: 'M17 8a1 1 0 0 1 1 1v4a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1z'},
    {tag: 'path', d: 'M9 8V2'},
  ],
};

export type IconProps = {
  /** Which icon to draw. */
  name: IconName;
  /** The icon's size, in dp. */
  size: number;
  /** The colour of the line. */
  color: string;
  /** The line's width, in the icon's own 24-unit box. */
  strokeWidth?: number;
};

/** One icon, drawn the way lucide draws it: a stroke, and no fill. */
export function Icon({name, size, color, strokeWidth = 1.6}: IconProps) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinejoin="round"
      strokeLinecap="round">
      {ICONS[name].map((node, index) => (
        <IconShape key={index} node={node} />
      ))}
    </Svg>
  );
}

function IconShape({node}: {node: IconNode}) {
  switch (node.tag) {
    case 'path':
      return <Path d={node.d} />;
    case 'rect':
      return (
        <Rect
          x={node.x}
          y={node.y}
          width={node.width}
          height={node.height}
          rx={node.rx}
        />
      );
    case 'line':
      return <Line x1={node.x1} y1={node.y1} x2={node.x2} y2={node.y2} />;
    case 'circle':
      return <Circle cx={node.cx} cy={node.cy} r={node.r} />;
    default:
      return null;
  }
}
