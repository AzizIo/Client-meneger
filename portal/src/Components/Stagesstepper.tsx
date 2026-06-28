// StageStepper.jsx
//
// Степпер этапов с горизонтальной линией между карточками и цветовой
// индикацией статуса (completed / in_progress / not_started) — как
// было задумано в Figma-промпте: "Брифинг ✅ → Прототип ✅ → Дизайн 🟡
// → Верстка ⬜ → Тестирование ⬜ → Релиз ⬜".

import { Check } from "lucide-react";
import { useEffect, useState } from "react";
import API from '../API/api'
import { useParams } from "react-router-dom";
// Маппинг статуса этапа на цвета — централизованно в одном месте,
// чтобы не разбрасывать одинаковые условия по всему JSX.
const STATUS_STYLES = {
  completed: {
    circle: "bg-indigo-600 text-white",
    line: "bg-indigo-600",
    label: "text-gray-900 font-medium",
  },
  in_progress: {
    circle: "bg-white border-2 border-indigo-600 text-indigo-600",
    line: "bg-gray-200",
    label: "text-indigo-700 font-medium",
  },
  not_started: {
    circle: "bg-white border-2 border-gray-300 text-gray-400",
    line: "bg-gray-200",
    label: "text-gray-400",
  },
};

export default function StageStepper({ stages, onStageClick }) {

  return (
    <div className="flex items-start overflow-x-auto py-4">
      {stages.map((stage, index) => {
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
              className="flex flex-col items-center gap-2 px-2"
            >
              <div
                className={[
                  "flex h-8 w-8 items-center justify-center rounded-full text-sm shrink-0",
                  styles.circle,
                ].join(" ")}
              >
                {/* Чекмарк для завершённых, номер этапа — для остальных */}
                {stage.status === "completed" ? (
                  <Check size={16} />
                ) : (
                  index + 1
                )}
              </div>
              <span className={["text-xs whitespace-nowrap", styles.label].join(" ")}>
                {stage.name}
              </span>
            </button>

            {/* Линия между текущим и следующим этапом — не рисуется
                после последнего элемента (isLast). Цвет линии берём
                от ТЕКУЩЕГО этапа: если он завершён — линия закрашена,
                если ещё нет — серая (это и даёт визуальный эффект
                "прогресс заливается слева направо"). */}
            {!isLast && (
              <div className={["h-0.5 w-12 sm:w-20 -mt-6", styles.line].join(" ")} />
            )}
          </div>
        );
      })}
    </div>
  );
}