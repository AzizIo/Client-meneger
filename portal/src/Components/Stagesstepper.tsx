// StageStepper.jsx
//
// Степпер этапов с горизонтальной линией между карточками и
// нейтральной индикацией статуса (completed / in_progress / not_started).
// Единый визуальный язык с designSystem: цвет статуса берётся из
// colors (ink/stampBlue/line/muted), а не из цветных Tailwind-заливок —
// см. Components/ui/designSystem.tsx.

import { Check } from "lucide-react";
import { colors, fontMono } from "./ui/designSystem";
import { motion } from "motion/react"

// Маппинг статуса этапа на стили — централизованно в одном месте,
// чтобы не разбрасывать одинаковые условия по всему JSX.
// "fully_approved" — стейдж завершён клиентом, все задачи одобрены,
// это approval-состояние, поэтому берём акцентный stampBlue (тот же
// тон, что и StampBadge tone="blue" для "на согласовании"/активных).
// "completed" — этап прошёл, но без привязки к approval-флоу — ink.
type StageStyle = {
  circleBg: string;
  circleText: string;
  circleBorder: string;
  line: string;
  label: string;
};

const STATUS_STYLES: Record<string, StageStyle> = {
  fully_approved: {
    circleBg: colors.stampBlue,
    circleText: "#FFFFFF",
    circleBorder: colors.stampBlue,
    line: colors.stampBlue,
    label: colors.stampBlue,
  },
  completed: {
    circleBg: colors.ink,
    circleText: "#FFFFFF",
    circleBorder: colors.ink,
    line: colors.ink,
    label: colors.ink,
  },
  in_progress: {
    circleBg: "#FFFFFF",
    circleText: colors.ink,
    circleBorder: colors.ink,
    line: colors.line,
    label: colors.ink,
  },
  not_started: {
    circleBg: "#FFFFFF",
    circleText: colors.muted,
    circleBorder: colors.line,
    line: colors.line,
    label: colors.muted,
  },
};

type StageStatus = string;

interface Stage {
  id: string;
  project_id: string;
  name: string;
  position: number;
  status: StageStatus;
  created_at: string;
}
interface StageStepperProps {
  stages: Stage[];
  currentStage?: string;
  onStageClick?: (id: string) => void;
  compact?: boolean;
}

export default function StageStepper({ stages, currentStage, onStageClick, compact = false }: StageStepperProps) {
  const circleSize = compact ? "h-6 w-6 text-xs" : "h-8 w-8 text-sm";
  const lineWidth = compact ? "w-8" : "w-12 sm:w-20";

  return (
    <div className="flex items-start overflow-x-auto py-4">
      {stages.map((stage, index) => {
        const isActive = currentStage === stage.id;
        const styles = STATUS_STYLES[stage.status] || STATUS_STYLES.not_started;
        const isLast = index === stages.length - 1;

        return (
          // key стоит на самом внешнем элементе цикла — обязательно
          // для .map(), иначе React не сможет эффективно отследить,
          // какой именно элемент изменился при обновлении списка.
          <div key={stage.id} className="flex items-center">
            {/* Один "узел" степпера: кружок + название под ним */}
            <motion.button
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              whileHover={{ y: -2, scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              transition={{ duration: 0.24, delay: index * 0.05, ease: 'easeOut' }}
              onClick={() => onStageClick?.(stage.id)}
              className={[
                "flex flex-col items-center",
                compact ? "px-1" : "gap-2 px-2",
              ].join(" ")}
            >
              <motion.div
                whileHover={{ scale: 1.05 }}
                className={[
                  "flex items-center justify-center rounded-full shrink-0 transition-colors border-2",
                  circleSize,
                ].join(" ")}
                style={{
                  backgroundColor: styles.circleBg,
                  color: styles.circleText,
                  borderColor: styles.circleBorder,
                  boxShadow: isActive ? `0 0 0 2px #FFFFFF, 0 0 0 4px ${colors.line}` : undefined,
                }}
              >
                {/* Чекмарк для завершённых, номер этапа — для остальных */}
                {stage.status === "completed" ? (
                  <Check size={16} />
                ) : (
                  index + 1
                )}
              </motion.div>
              {!compact && (
                <span
                  className="text-xs whitespace-nowrap font-medium"
                  style={{ color: styles.label, fontFamily: fontMono }}
                >
                  {stage.name}
                </span>
              )}
            </motion.button>

            {/* Линия между текущим и следующим этапом — не рисуется
                после последнего элемента (isLast). Цвет линии берём
                от ТЕКУЩЕГО этапа: если он завершён/approved — линия
                закрашена акцентом, если ещё нет — line (это и даёт
                визуальный эффект "прогресс заливается слева направо"). */}
            {!isLast && (
              <div
                className={[
                  "h-0.5",
                  lineWidth,
                  compact ? "" : "-mt-6",
                  "transition-colors",
                ].join(" ")}
                style={{ backgroundColor: styles.line }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}