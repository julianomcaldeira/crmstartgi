import { useDroppable } from "@dnd-kit/core";
import { ReactNode } from "react";

interface DroppableColumnProps {
  id: string;
  children: ReactNode;
}

export const DroppableColumn = ({ id, children }: DroppableColumnProps) => {
  const { setNodeRef, isOver } = useDroppable({
    id,
  });

  return (
    <div
      ref={setNodeRef}
      className={`min-h-[200px] transition-colors ${
        isOver ? "bg-primary/5 rounded-lg" : ""
      }`}
    >
      {children}
    </div>
  );
};
