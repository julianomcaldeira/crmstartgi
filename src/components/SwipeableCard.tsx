import { useState, ReactNode } from "react";
import { useSwipeable } from "react-swipeable";
import { Button } from "@/components/ui/button";
import { Edit, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface SwipeableCardProps {
  children: ReactNode;
  onEdit?: () => void;
  onDelete?: () => void;
  className?: string;
}

export function SwipeableCard({ children, onEdit, onDelete, className }: SwipeableCardProps) {
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);

  const handlers = useSwipeable({
    onSwiping: (eventData) => {
      // Only allow swipe on mobile/touch devices
      if (window.innerWidth > 768) return;
      
      const offset = eventData.deltaX;
      // Limit swipe to -120px (show both buttons)
      if (offset < 0 && offset > -120) {
        setSwipeOffset(offset);
        setIsSwiping(true);
      }
    },
    onSwiped: (eventData) => {
      if (window.innerWidth > 768) return;
      
      setIsSwiping(false);
      // If swiped more than 60px, lock at -120px to show actions
      if (eventData.deltaX < -60) {
        setSwipeOffset(-120);
      } else {
        setSwipeOffset(0);
      }
    },
    trackMouse: false,
    trackTouch: true,
    preventScrollOnSwipe: true,
  });

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    onEdit?.();
    setSwipeOffset(0);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete?.();
    setSwipeOffset(0);
  };

  return (
    <div className="relative overflow-hidden">
      {/* Swipe actions background - only visible on mobile */}
      <div className="absolute right-0 top-0 bottom-0 w-[120px] flex md:hidden">
        {onEdit && (
          <Button
            size="icon"
            variant="ghost"
            className="h-full w-[60px] rounded-none bg-primary/10 hover:bg-primary/20"
            onClick={handleEdit}
          >
            <Edit className="h-5 w-5" />
          </Button>
        )}
        {onDelete && (
          <Button
            size="icon"
            variant="ghost"
            className="h-full w-[60px] rounded-none bg-destructive/10 hover:bg-destructive/20"
            onClick={handleDelete}
          >
            <Trash2 className="h-5 w-5 text-destructive" />
          </Button>
        )}
      </div>

      {/* Card content */}
      <div
        {...handlers}
        className={cn(
          "transition-transform",
          isSwiping ? "duration-0" : "duration-300",
          className
        )}
        style={{ transform: `translateX(${swipeOffset}px)` }}
        onClick={() => swipeOffset !== 0 && setSwipeOffset(0)}
      >
        {children}
      </div>
    </div>
  );
}
