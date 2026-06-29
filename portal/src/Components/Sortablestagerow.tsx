// SortableStageRow.jsx
//
// Одна строка в списке "Управление шагами" — с инпутом редактирования,
// кнопкой удаления и "ручкой" для перетаскивания.
//
// Почему это ОТДЕЛЬНЫЙ компонент, а не просто JSX внутри .map() в
// родителе: хук useSortable должен вызываться на каждом элементе
// списка ИНДИВИДУАЛЬНО — React-хуки нельзя вызывать внутри цикла
// (.map()) напрямую, только внутри отдельного компонента, который
// сам по себе и есть "один элемент цикла".

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Trash2 } from 'lucide-react';


export default function SortableStageRow({ stage, onNameChange, onDelete }) {
  const {
    attributes,   // ARIA-атрибуты для доступности (screen readers)
    listeners,    // обработчики событий мыши/тача — именно они "ловят" начало перетаскивания
    setNodeRef,   // ref, который связывает этот DOM-элемент с dnd-kit
    transform,    // текущее смещение элемента во время перетаскивания
    transition,   // CSS-переход для плавной анимации, когда элементы "уступают место"
    isDragging,   // true, когда именно ЭТОТ элемент сейчас тащат
  } = useSortable({ id: stage.id });

  // CSS.Transform.toString(transform) превращает объект {x, y} в
  // строку вида "translate3d(10px, 0px, 0)" для inline-style.
  // Без этого преобразования transform не применится к элементу.
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1, // полупрозрачность для элемента, который сейчас тащат
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 mx-8 mb-3"
    >
      {/* "Ручка" для перетаскивания — {...attributes} {...listeners}
          стоят ИМЕННО здесь, а не на всей строке. Если повесить их
          на весь div, перетаскивание будет начинаться при клике
          в любом месте строки, включая инпут — это сломает обычный
          клик в поле для редактирования текста. */}
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab touch-none text-gray-400 hover:text-gray-600 active:cursor-grabbing"
      >
        <GripVertical size={18} />
      </button>

      <input
        value={stage.name}
        onChange={(e) => onNameChange(stage.id, e.target.value)}
        type="text"
        className="flex-1 rounded border border-gray-300 px-3 py-1.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
      />

      <button
        onClick={() => onDelete(stage.id)}
        className="p-3 rounded bg-red-500 hover:bg-red-600"
      >
        <Trash2 size={16} color="white" />
      </button>
    </div>
  );
}