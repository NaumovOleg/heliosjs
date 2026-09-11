import React from 'react';
import { useColorMode } from '@docusaurus/theme-common';

/**
 * Horizontal bar chart for the benchmarks doc page. A real React component
 * (not raw HTML in the .md file) because Docusaurus's MDX pipeline parses
 * `<style>`/CSS-in-markdown as JS expressions and chokes on plain CSS — see
 * the commit that added this. `useColorMode` gives it real light/dark
 * awareness instead.
 */

const ORDER = ['Helios', 'Express', 'Fastify', 'NestJS'] as const;

// Fixed categorical colors, by entity, never by rank — same mapping in every
// chart. Slots 1-4 of the validated default palette (dataviz skill,
// references/palette.md): passes the adjacent-pair CVD/contrast checks for a
// 4-series bar chart in both light and dark mode.
const COLORS: Record<(typeof ORDER)[number], { light: string; dark: string }> = {
  Helios: { light: '#2a78d6', dark: '#3987e5' },
  Express: { light: '#eb6834', dark: '#d95926' },
  Fastify: { light: '#1baf7a', dark: '#199e70' },
  NestJS: { light: '#eda100', dark: '#c98500' },
};

const MAX_TICK = 120_000;
const TICK_STEP = 20_000;
const PLOT_X0 = 96; // after the left framework-name label
const PLOT_W = 380;
const ROW_H = 20; // bar thickness (<=24px spec)
const ROW_STEP = 40; // bar + air between rows
const TOP_PAD = 8;
const AXIS_H = 26;
const WIDTH = PLOT_X0 + PLOT_W + 64; // + room for the value label past the longest bar

function scaleX(v: number): number {
  return Math.round(((v / MAX_TICK) * PLOT_W + Number.EPSILON) * 10) / 10;
}

function fmt(n: number): string {
  return n.toLocaleString('en-US');
}

interface BenchChartProps {
  title: string;
  data: Record<(typeof ORDER)[number], number>;
}

export default function BenchChart({ title, data }: BenchChartProps) {
  const { colorMode } = useColorMode();
  const isDark = colorMode === 'dark';
  const surface = isDark ? '#1a1a19' : '#fcfcfb';
  const grid = isDark ? '#333230' : '#e4e3de';
  const text = isDark ? '#ffffff' : '#0b0b0b';
  const text2 = isDark ? '#c3c2b7' : '#52514e';

  const rows = ORDER.map((name) => ({ name, value: data[name] })).sort((a, b) => b.value - a.value);
  const plotH = rows.length * ROW_STEP - (ROW_STEP - ROW_H);
  const height = TOP_PAD + plotH + AXIS_H;

  const ticks: number[] = [];
  for (let t = 0; t <= MAX_TICK; t += TICK_STEP) ticks.push(t);

  return (
    <div style={{ background: surface, borderRadius: 8, padding: '16px 12px', margin: '1rem 0' }}>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '4px 16px',
          margin: '0 0 12px 4px',
          fontSize: 13,
          color: text2,
        }}
      >
        {ORDER.map((name) => (
          <span key={name} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <i
              style={{
                width: 10,
                height: 10,
                borderRadius: 2,
                display: 'inline-block',
                background: COLORS[name][colorMode],
              }}
            />
            {name}
          </span>
        ))}
      </div>
      <svg
        viewBox={`0 0 ${WIDTH} ${height}`}
        width="100%"
        height="auto"
        style={{ display: 'block', margin: '0.5rem 0 0.25rem' }}
        role="img"
        aria-label={`Requests per second, ${title}: ${rows
          .map((r) => `${r.name} ${fmt(r.value)}`)
          .join(', ')}.`}
      >
        {ticks.map((t) => {
          const x = PLOT_X0 + scaleX(t);
          return (
            <line key={t} x1={x} y1={TOP_PAD} x2={x} y2={TOP_PAD + plotH} stroke={grid} strokeWidth={1} />
          );
        })}
        {rows.map((r, i) => {
          const y = TOP_PAD + i * ROW_STEP;
          const w = scaleX(r.value);
          const cy = y + ROW_H / 2;
          return (
            <g key={r.name}>
              <text
                x={PLOT_X0 - 10}
                y={cy}
                textAnchor="end"
                dominantBaseline="middle"
                fontSize={12}
                fontWeight={600}
                fill={text}
              >
                {r.name}
              </text>
              <rect x={PLOT_X0} y={y} width={w} height={ROW_H} rx={4} ry={4} fill={COLORS[r.name][colorMode]}>
                <title>
                  {r.name}: {fmt(r.value)} req/s
                </title>
              </rect>
              <text
                x={PLOT_X0 + w + 8}
                y={cy}
                dominantBaseline="middle"
                fontSize={12}
                fill={text2}
                style={{ fontVariantNumeric: 'tabular-nums' }}
              >
                {fmt(r.value)}
              </text>
            </g>
          );
        })}
        {ticks.map((t) => {
          const x = PLOT_X0 + scaleX(t);
          return (
            <text key={t} x={x} y={TOP_PAD + plotH + 18} textAnchor="middle" fontSize={11} fill={text2}>
              {t === 0 ? '0' : `${t / 1000}k`}
            </text>
          );
        })}
      </svg>
    </div>
  );
}
