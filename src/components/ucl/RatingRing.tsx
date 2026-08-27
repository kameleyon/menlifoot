import { useEffect, useState } from 'react';

interface Props {
  value: number;
  size?: number;
  label?: string;
}

/**
 * Score ring. The stroke animates from 0 on mount so the number lands rather
 * than appearing — the reveal is the payoff of the whole flow.
 */
const RatingRing = ({ value, size = 168, label = '/ 100' }: Props) => {
  const [shown, setShown] = useState(0);
  const stroke = 12;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;

  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(value));
    return () => cancelAnimationFrame(id);
  }, [value]);

  // Red below 50, amber to 74, green above — matches how managers read a score.
  const color = value >= 75 ? 'hsl(142 71% 45%)' : value >= 50 ? 'hsl(38 92% 50%)' : 'hsl(0 84% 60%)';

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          className="stroke-muted"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          stroke={color}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference - (Math.max(0, Math.min(100, shown)) / 100) * circumference}
          style={{ transition: 'stroke-dashoffset 1.1s cubic-bezier(0.22, 1, 0.36, 1)' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-5xl leading-none" style={{ color }}>
          {value}
        </span>
        <span className="mt-1 font-sans text-xs text-muted-foreground">{label}</span>
      </div>
    </div>
  );
};

export default RatingRing;
