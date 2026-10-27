import { formatVnd } from '@/lib/format';

// Biểu đồ đường SVG tự vẽ (SPEC-admin.md: không thêm thư viện biểu đồ). Co giãn theo chiều rộng màn hình.
export function LineChart({ points, label }: { points: { day: string; value: number }[]; label: string }) {
  const W = 600;
  const H = 180;
  const pad = 24;
  const max = Math.max(1, ...points.map((p) => p.value));
  const x = (i: number) => pad + (i * (W - pad * 2)) / Math.max(points.length - 1, 1);
  const y = (v: number) => H - pad - (v / max) * (H - pad * 2);
  const path = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`)
    .join(' ');
  const total = points.reduce((s, p) => s + p.value, 0);
  return (
    <figure className="flex flex-col gap-2">
      <figcaption className="flex items-baseline justify-between text-sm">
        <span className="font-bold">{label}</span>
        <span className="text-white/60">Tổng {formatVnd(total)}</span>
      </figcaption>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-44 w-full"
        role="img"
        aria-label={`${label}: tổng ${formatVnd(total)}`}
      >
        <line x1={pad} x2={W - pad} y1={H - pad} y2={H - pad} stroke="currentColor" strokeOpacity="0.15" />
        <path
          d={`${path} L${x(points.length - 1)},${H - pad} L${x(0)},${H - pad} Z`}
          fill="#fc6f15"
          fillOpacity="0.12"
        />
        <path d={path} fill="none" stroke="#c2410c" strokeWidth="2.5" strokeLinejoin="round" />
        {points.map((p, i) =>
          p.value > 0 ? (
            <circle key={p.day} cx={x(i)} cy={y(p.value)} r="3" fill="#c2410c">
              <title>{`${p.day}: ${formatVnd(p.value)}`}</title>
            </circle>
          ) : null,
        )}
        <text x={pad} y={H - 6} fontSize="11" fill="currentColor" fillOpacity="0.5">
          {points[0]?.day.slice(5)}
        </text>
        <text x={W - pad} y={H - 6} fontSize="11" textAnchor="end" fill="currentColor" fillOpacity="0.5">
          {points.at(-1)?.day.slice(5)}
        </text>
        <text x={pad} y={14} fontSize="11" fill="currentColor" fillOpacity="0.5">
          {formatVnd(max)}
        </text>
      </svg>
    </figure>
  );
}
