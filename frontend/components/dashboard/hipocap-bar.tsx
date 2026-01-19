import { isNil } from "lodash";
import React from "react";

interface TimeSeriesDataPoint {
  timestamp: string;
  blocked: number;
  allowed: number;
}

interface CustomBarProps {
  fill?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  payload?: TimeSeriesDataPoint;
}

const MIN_BAR_HEIGHT = 3;

const chartConfig = {
  blocked: {
    color: "hsl(var(--destructive))",
  },
  allowed: {
    color: "hsl(var(--success))",
  },
} as const;

// custom shape for rounded bars
const HipocapRoundedBar = (props: CustomBarProps) => {
  const { fill, x, y, width, height = 0, payload } = props;

  if (isNil(x) || isNil(y) || isNil(width) || !fill || !payload) return <></>;

  const isAllowed = fill === chartConfig.allowed.color;
  const hasAllowed = payload.allowed > 0;
  const hasBlocked = payload.blocked > 0;

  if (isAllowed && !hasAllowed) return <></>;
  if (!isAllowed && !hasBlocked) return <></>;

  const hasBoth = hasAllowed && hasBlocked;

  const barHeight = height > 0 && height < MIN_BAR_HEIGHT ? MIN_BAR_HEIGHT : height;
  const barY = barHeight > height ? y - (barHeight - height) : y;

  const radius = isAllowed ? (hasBoth ? [0, 0, 4, 4] : [4, 4, 4, 4]) : hasBoth ? [4, 4, 0, 0] : [4, 4, 4, 4];

  const [tl, tr, br, bl] = radius;

  return (
    <path
      d={`
        M ${x} ${barY + tl}
        Q ${x} ${barY}, ${x + tl} ${barY}
        L ${x + width - tr} ${barY}
        Q ${x + width} ${barY}, ${x + width} ${barY + tr}
        L ${x + width} ${barY + barHeight - br}
        Q ${x + width} ${barY + barHeight}, ${x + width - br} ${barY + barHeight}
        L ${x + bl} ${barY + barHeight}
        Q ${x} ${barY + barHeight}, ${x} ${barY + barHeight - bl}
        Z
      `}
      fill={fill}
    />
  );
};

export default HipocapRoundedBar;

