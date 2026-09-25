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
  ComposedChart,
  LabelList,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { CATEGORICAL, CHROME, DIVERGING, fmtSg, niceAxis, sgColor } from '@/lib/insights/chart-colors';

const AXIS_STYLE = { fontSize: 11, fill: CHROME.mutedInk };

/**
 * A named format, not a function — a Server Component page cannot pass a
 * function prop to a 'use client' component (Next.js App Router serializes
 * props across that boundary), so formatting choices are threaded through
 * as plain data instead.
 */
type ValueFormat = 'sg' | 'plain' | 'percent' | 'toPar';

/** Score to par as golfers write it: +6, −2, E. */
const toPar = (v: number) => (Math.round(v * 10) / 10 === 0 ? 'E' : `${v > 0 ? '+' : '−'}${Number.isInteger(v) ? Math.abs(v) : Math.abs(v).toFixed(1)}`);

function formatValue(v: number, format: ValueFormat, suffix?: string): string {
  const base = format === 'sg' ? fmtSg(v) : format === 'percent' ? `${v}%` : format === 'toPar' ? toPar(v) : `${v}`;
  return suffix ? `${base} ${suffix}` : base;
}

/** The number printed on a bar: SG to `digits` decimals (1 by default; per-shot values need 2). */
function labelText(v: number, format: ValueFormat, digits: number): string {
  if (format === 'sg') return fmtSg(v, digits);
  if (format === 'percent') return `${Math.round(v)}%`;
  if (format === 'toPar') return toPar(v);
  return Number.isInteger(v) ? `${v}` : v.toFixed(1);
}

type LabelProps = { x?: number | string; y?: number | string; width?: number | string; height?: number | string; value?: unknown };

/**
 * Value label drawn just past the end of the bar — above a positive bar, below a negative one —
 * so every bar carries its number and the chart reads without hovering.
 */
function barLabel(format: ValueFormat, digits: number) {
  const BarValueLabel = (props: LabelProps) => {
    const v = Number(props.value);
    if (props.value === null || props.value === undefined || !Number.isFinite(v)) return null;
    const x = Number(props.x) + Number(props.width) / 2;
    const y = Number(props.y);
    const h = Number(props.height);
    const top = Math.min(y, y + h);
    const bottom = Math.max(y, y + h);
    return (
      <text x={x} y={v < 0 ? bottom + 12 : top - 4} textAnchor="middle" fontSize={11} fill={CHROME.mutedInk}>
        {labelText(v, format, digits)}
      </text>
    );
  };
  return BarValueLabel;
}

const valuesOf = (data: Record<string, unknown>[], keys: string[]) =>
  data.flatMap((d) => keys.map((k) => Number(d[k]))).filter((v) => Number.isFinite(v));

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** ISO dates on a round axis read as "13 Sep". */
function shortDate(v: unknown): string {
  const m = /^\d{4}-(\d{2})-(\d{2})$/.exec(String(v));
  return m ? `${Number(m[2])} ${MONTHS[Number(m[1]) - 1]}` : String(v);
}

/** A single bar series over categorical/ordinal x, colored by SG sign. */
export function DivergingBarChart({
  data,
  xKey,
  yKey,
  height = 220,
  format = 'sg',
  suffix,
  digits = 1,
}: {
  data: Record<string, unknown>[];
  xKey: string;
  yKey: string;
  height?: number;
  format?: ValueFormat;
  suffix?: string;
  /** Decimals on the bar labels (SG only). */
  digits?: number;
}) {
  const axis = niceAxis(valuesOf(data, [yKey]));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 16, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={CHROME.gridline} />
        <XAxis dataKey={xKey} tick={AXIS_STYLE} axisLine={{ stroke: CHROME.baseline }} tickLine={false} />
        <YAxis tick={AXIS_STYLE} axisLine={false} tickLine={false} width={40} domain={axis.domain} ticks={axis.ticks} tickFormatter={(v: number) => labelText(v, format, Math.max(1, axis.decimals))} />
        <Tooltip
          formatter={(v: number) => formatValue(v, format, suffix)}
          contentStyle={{ fontSize: 12, borderColor: CHROME.gridline }}
        />
        <Bar dataKey={yKey} radius={[4, 4, 4, 4]} maxBarSize={40} isAnimationActive={false}>
          {data.map((d, i) => (
            <Cell key={i} fill={sgColor(Number(d[yKey]))} />
          ))}
          <LabelList dataKey={yKey} content={barLabel(format, digits)} />
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
  const axis = domain ? { domain, ticks: undefined, decimals: 0 } : niceAxis(valuesOf(data, series.map((x) => x.key)));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 16, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={CHROME.gridline} />
        <XAxis dataKey={xKey} tick={AXIS_STYLE} axisLine={{ stroke: CHROME.baseline }} tickLine={false} tickFormatter={shortDate} />
        <YAxis tick={AXIS_STYLE} axisLine={false} tickLine={false} width={36} domain={axis.domain} ticks={axis.ticks} />
        <Tooltip
          formatter={(v: number) => formatValue(v, format, suffix)}
          labelFormatter={shortDate}
          contentStyle={{ fontSize: 12, borderColor: CHROME.gridline }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {series.map((s) => (
          <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.color} radius={[4, 4, 4, 4]} maxBarSize={28} isAnimationActive={false}>
            <LabelList dataKey={s.key} content={barLabel(format, 1)} />
          </Bar>
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

/**
 * A round-over-time bar chart: one labelled bar per round (SG bars coloured by sign), plus an
 * optional rolling-average line on top. Bars rather than a line, so each round's number and the
 * scale are visible at a glance.
 */
export function TrendBarChart({
  data,
  xKey,
  valueKey,
  rollingKey,
  rollingLabel = 'Rolling average',
  height = 180,
  domain,
  format = 'sg',
  suffix,
}: {
  data: Record<string, unknown>[];
  xKey: string;
  valueKey: string;
  rollingKey?: string;
  rollingLabel?: string;
  height?: number;
  domain?: [number, number];
  format?: ValueFormat;
  suffix?: string;
}) {
  const axis = domain ? { domain, ticks: undefined, decimals: 0 } : niceAxis(valuesOf(data, rollingKey ? [valueKey, rollingKey] : [valueKey]));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 16, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={CHROME.gridline} />
        <XAxis dataKey={xKey} tick={AXIS_STYLE} axisLine={{ stroke: CHROME.baseline }} tickLine={false} tickFormatter={shortDate} />
        <YAxis tick={AXIS_STYLE} axisLine={false} tickLine={false} width={36} domain={axis.domain} ticks={axis.ticks} tickFormatter={(v: number) => labelText(v, format, Math.max(1, axis.decimals))} />
        <Tooltip
          formatter={(v: number) => formatValue(v, format, suffix)}
          labelFormatter={shortDate}
          contentStyle={{ fontSize: 12, borderColor: CHROME.gridline }}
        />
        <Bar dataKey={valueKey} name="This round" radius={[4, 4, 4, 4]} maxBarSize={40} fill={CATEGORICAL[0]} isAnimationActive={false}>
          {format === 'sg' && data.map((d, i) => <Cell key={i} fill={sgColor(Number(d[valueKey]))} />)}
          <LabelList dataKey={valueKey} content={barLabel(format, 1)} />
        </Bar>
        {rollingKey && (
          <Line type="monotone" dataKey={rollingKey} name={rollingLabel} stroke={CHROME.mutedInk} strokeWidth={2} strokeDasharray="4 3" dot={false} isAnimationActive={false} />
        )}
      </ComposedChart>
    </ResponsiveContainer>
  );
}

export type QualityTrendDatum = {
  playedOn: string;
  /** This round's shot quality. */
  round: number;
  roundShots: number;
  /** Rolling (pooled) shot quality. */
  rolling: number;
  rollingShots: number;
  /** Rolling window under the shot floor: drawn hollow. */
  thin: boolean;
};

type DotProps = { cx?: number; cy?: number; index?: number; payload?: QualityTrendDatum };

/**
 * Shot quality over time: a dot per round, a solid rolling line through them, and a dashed line
 * at 100 (scratch). A line, not bars: the axis doesn't start at zero, so bar length would lie.
 * Axis domain and ticks come from the server (`qualityAxis`), as plain data.
 */
export function QualityTrendChart({
  data,
  domain,
  ticks,
  height = 180,
}: {
  data: QualityTrendDatum[];
  domain: [number, number];
  ticks: number[];
  height?: number;
}) {
  const RollingDot = ({ cx, cy, index, payload }: DotProps) =>
    cx === undefined || cy === undefined ? (
      <g key={`r-${index}`} />
    ) : (
      <circle
        key={`r-${index}`}
        cx={cx}
        cy={cy}
        r={3.5}
        fill={payload?.thin ? CHROME.surface : CATEGORICAL[0]}
        stroke={CATEGORICAL[0]}
        strokeWidth={1.5}
      />
    );
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 12, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={CHROME.gridline} />
        <XAxis dataKey="playedOn" tick={AXIS_STYLE} axisLine={{ stroke: CHROME.baseline }} tickLine={false} tickFormatter={shortDate} />
        <YAxis tick={AXIS_STYLE} axisLine={false} tickLine={false} width={32} domain={domain} ticks={ticks} allowDataOverflow />
        <ReferenceLine
          y={100}
          stroke={CHROME.secondaryInk}
          strokeDasharray="4 3"
          label={{ value: 'scratch', position: 'insideTopLeft', fontSize: 10, fill: CHROME.secondaryInk }}
        />
        <Tooltip
          labelFormatter={shortDate}
          contentStyle={{ fontSize: 12, borderColor: CHROME.gridline }}
          formatter={(v: number, name: string, item: { payload?: QualityTrendDatum }) => {
            const d = item.payload;
            const shots = name === 'This round' ? d?.roundShots : d?.rollingShots;
            return [`${Math.round(v)}${shots !== undefined ? ` (${shots} shots)` : ''}`, name];
          }}
        />
        <Line
          dataKey="round"
          name="This round"
          stroke="none"
          dot={{ r: 2.5, fill: CHROME.mutedInk, stroke: 'none' }}
          activeDot={{ r: 4 }}
          isAnimationActive={false}
        />
        <Line
          type="monotone"
          dataKey="rolling"
          name="Last 5 rounds"
          stroke={CATEGORICAL[0]}
          strokeWidth={2}
          dot={RollingDot}
          isAnimationActive={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

export { CATEGORICAL, DIVERGING };
