// designSystem.tsx
//
// Общие токены и building-block компоненты визуального направления
// приложения — "proof sheet / штамп корректора". Импортируется в
// каждую страницу, чтобы не дублировать цвета/шрифты/StampBadge
// по всему проекту.

export const colors = {
  ink: '#1C1B19',
  paper: '#FAFAF8',
  line: '#DDDAD3',
  stampBlue: '#2C4A8C',
  stampRed: '#A23B2E',
  muted: '#8A8681',
} as const;

export const fontDisplay = "'Space Grotesk', sans-serif";
export const fontMono = "'IBM Plex Mono', monospace";

const toneClasses = {
  ink: 'border-[#1C1B19] text-[#1C1B19]',
  blue: 'border-[#2C4A8C] text-[#2C4A8C]',
  red: 'border-[#A23B2E] text-[#A23B2E]',
} as const;

export type StampTone = keyof typeof toneClasses;

export function StampBadge({ label, tone = 'ink' }: { label: string; tone?: StampTone }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded border-[1.5px] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider -rotate-2 whitespace-nowrap ${toneClasses[tone]}`}
      style={{ fontFamily: fontMono }}
    >
      {label}
    </span>
  );
}

export function CornerMarks() {
  return (
    <>
      <span className="pointer-events-none absolute -top-px -left-px h-3 w-3 border-t-[1.5px] border-l-[1.5px] border-[#2C4A8C] opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
      <span className="pointer-events-none absolute -top-px -right-px h-3 w-3 border-t-[1.5px] border-r-[1.5px] border-[#2C4A8C] opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
      <span className="pointer-events-none absolute -bottom-px -left-px h-3 w-3 border-b-[1.5px] border-l-[1.5px] border-[#2C4A8C] opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
      <span className="pointer-events-none absolute -bottom-px -right-px h-3 w-3 border-b-[1.5px] border-r-[1.5px] border-[#2C4A8C] opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
    </>
  );
}

export function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="text-[11px] font-medium uppercase tracking-[0.12em]"
      style={{ color: colors.muted, fontFamily: fontMono }}
    >
      {children}
    </p>
  );
}

// Общие классы кнопок — единый визуальный язык на всё приложение.
// ink-заливка вместо gray-900, но поведение (hover/disabled) то же.
export const btnPrimary =
  'inline-flex items-center justify-center gap-2 rounded-md text-white px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none';
export const btnPrimaryStyle = { backgroundColor: colors.ink };

export const btnOutline =
  'inline-flex items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-medium transition-colors hover:bg-black/[0.03]';
export const btnOutlineStyle = { border: `1px solid ${colors.line}`, color: colors.ink };