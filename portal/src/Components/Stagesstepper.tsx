// StageStepper.jsx
//
// Степпер этапов с горизонтальной линией между карточками и
// нейтральной индикацией статуса (completed / in_progress / not_started).
// Единый визуальный язык с остальным приложением: чёрный/серый вместо
// цветных заливок, статус читается по насыщенности, а не по цвету.

import { Check } from "lucide-react";

// Маппинг статуса этапа на стили — централизованно в одном месте,
// чтобы не разбрасывать одинаковые условия по всему JSX.
// Добавляем новый статус "fully_approved" — стейдж завершён клиентом,
// все задачи одобрены. Отличаем от "completed" (может значить просто
// "этап прошёл", без привязки к approval-флоу).
const STATUS_STYLES = {
  fully_approved: {
    circle: "bg-violet-600 text-white",
    line: "bg-violet-600",
    label: "text-violet-700 font-medium",
  },
  completed: {
    circle: "bg-gray-900 text-white",
    line: "bg-gray-900",
    label: "text-gray-900 font-medium",
  },
  in_progress: {
    circle: "bg-white border-2 border-gray-900 text-gray-900",
    line: "bg-gray-200",
    label: "text-gray-900 font-medium",
  },
  not_started: {
    circle: "bg-white border-2 border-gray-200 text-gray-400",
    line: "bg-gray-200",
    label: "text-gray-400",
  },
};

type StageStatus = "fully_approved" | "completed" | "in_progress" | "not_started";

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
  currentStage: string
  onStageClick: (id: string) => void;
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
            <button
              onClick={() => onStageClick?.(stage.id)}
              className={[
                "flex flex-col items-center",
                compact ? "px-1" : "gap-2 px-2",
              ].join(" ")}
            >
              <div
                className={[
                  "flex items-center justify-center rounded-full shrink-0 transition-colors",
                  circleSize,
                  styles.circle,
                  isActive && "ring-2 ring-gray-300 ring-offset-2",
                ].join(" ")}
              >
                {/* Чекмарк для завершённых, номер этапа — для остальных */}
                {stage.status === "completed" ? (
                  <Check size={16} />
                ) : (
                  index + 1
                )}
              </div>
              {!compact && (
                <span
                  className={["text-xs whitespace-nowrap", styles.label].join(" ")}
                >
                  {stage.name}
                </span>
              )}
            </button>

            {/* Линия между текущим и следующим этапом — не рисуется
                после последнего элемента (isLast). Цвет линии берём
                от ТЕКУЩЕГО этапа: если он завершён — линия закрашена,
                если ещё нет — серая (это и даёт визуальный эффект
                "прогресс заливается слева направо"). */}
            {!isLast && (
              <div
                className={[
                  "h-0.5",
                  lineWidth,
                  compact ? "" : "-mt-6",
                  styles.line,
                  "transition-colors",
                ].join(" ")}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}