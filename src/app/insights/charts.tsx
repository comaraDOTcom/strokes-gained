'use client';

/**
 * Chart components for `/insights` and `/trends`. Thin wrappers around
 * Recharts, styled per the `dataviz` skill: diverging blue/red for SG
 * (polarity — gained vs. lost), fixed-order categorical hues for identity
 * comparisons (never cycled), one axis per chart, recessive gridlines,
 * a legend whenever there are >= 2 series.
 */
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { CATEGORICAL, CHROME, DIVERGING, fmtSg, sgColor } from '@/lib/insights/chart-colors';

const AXIS_STYLE = { fontSize: 11, fill: CHROME.mutedInk };

/**
 * A named format, not a function — a Server Component page cannot pass a
 * function prop to a 'use client' component (Next.js App Router serializes
 * props across that boundary), so formatting choices are threaded through
 * as plain data instead.
 */
type ValueFormat = 'sg' | 'plain' | 'percent';

function formatValue(v: number, format: ValueFormat, suffix?: string): string {
  const base = format === 'sg' ? fmtSg(v) : format === 'percent' ? `${v}%` : `${v}`;
  return suffix ? `${base} ${suffix}` : base;
}

/** A single bar series over categorical/ordinal x, colored by SG sign. */
export function DivergingBarChart({
  data,
  xKey,
  yKey,
  height = 220,
  format = 'sg',
  suffix,
}: {
  data: Record<string, unknown>[];
  xKey: string;
  yKey: string;
  height?: number;
  format?: ValueFormat;
  suffix?: string;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={CHROME.gridline} />
        <XAxis dataKey={xKey} tick={AXIS_STYLE} axisLine={{ stroke: CHROME.baseline }} tickLine={false} />
        <YAxis tick={AXIS_STYLE} axisLine={false} tickLine={false} width={36} />
        <Tooltip
          formatter={(v: number) => formatValue(v, format, suffix)}
          contentStyle={{ fontSize: 12, borderColor: CHROME.gridline }}
        />
        <Bar dataKey={yKey} radius={[4, 4, 4, 4]} maxBarSize={40}>
          {data.map((d, i) => (
            <Cell key={i} fill={sgColor(Number(d[yKey]))} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Two fixed-color series (e.g. "prior 3 avg" vs "latest") grouped per category. */
export function GroupedBarChart({
  data,
  xKey,
  series,
  height = 240,
  format = 'sg',
  suffix,
  domain,
}: {
  data: Record<string, unknown>[];
  xKey: string;
  series: { key: string; label: string; color: string }[];
  height?: number;
  format?: ValueFormat;
  suffix?: string;
  domain?: [number, number];
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={CHROME.gridline} />
        <XAxis dataKey={xKey} tick={AXIS_STYLE} axisLine={{ stroke: CHROME.baseline }} tickLine={false} />
        <YAxis tick={AXIS_STYLE} axisLine={false} tickLine={false} width={36} domain={domain} />
        <Tooltip
          formatter={(v: number) => formatValue(v, format, suffix)}
          contentStyle={{ fontSize: 12, borderColor: CHROME.gridline }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {series.map((s) => (
          <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.color} radius={[4, 4, 4, 4]} maxBarSize={28} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

/** A round-over-time line: raw per-round value (dots) + a rolling average line. Single series -> no legend needed. */
export function TrendLineChart({
  data,
  xKey,
  valueKey,
  rollingKey,
  height = 160,
  domain,
  format = 'sg',
  suffix,
}: {
  data: Record<string, unknown>[];
  xKey: string;
  valueKey: string;
  rollingKey?: string;
  height?: number;
  domain?: [number, number];
  format?: ValueFormat;
  suffix?: string;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={CHROME.gridline} />
        <XAxis dataKey={xKey} tick={AXIS_STYLE} axisLine={{ stroke: CHROME.baseline }} tickLine={false} />
        <YAxis tick={AXIS_STYLE} axisLine={false} tickLine={false} width={36} domain={domain} />
        <Tooltip
          formatter={(v: number) => formatValue(v, format, suffix)}
          contentStyle={{ fontSize: 12, borderColor: CHROME.gridline }}
        />
        <Line
          type="monotone"
          dataKey={valueKey}
          stroke={CATEGORICAL[0]}
          strokeWidth={1.5}
          dot={{ r: 3, fill: CATEGORICAL[0] }}
          strokeOpacity={0.45}
        />
        {rollingKey && (
          <Line type="monotone" dataKey={rollingKey} stroke={CATEGORICAL[0]} strokeWidth={2.5} dot={false} />
        )}
      </LineChart>
    </ResponsiveContainer>
  );
}

export { CATEGORICAL, DIVERGING };
