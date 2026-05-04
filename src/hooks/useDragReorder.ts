import { useState, useRef, useCallback } from "react";

interface UseDragReorderOptions<T> {
  items: T[];
  onReorder: (reordered: T[]) => void;
  canDrag?: (item: T, index: number) => boolean;
}

export function useDragReorder<T>({ items, onReorder, canDrag }: UseDragReorderOptions<T>) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const dragNode = useRef<HTMLElement | null>(null);

  const handleDragStart = useCallback((e: React.DragEvent, index: number) => {
    if (canDrag && !canDrag(items[index], index)) {
      e.preventDefault();
      return;
    }
    setDragIndex(index);
    dragNode.current = e.currentTarget as HTMLElement;
    e.dataTransfer.effectAllowed = "move";
    // Make the drag image slightly transparent
    requestAnimationFrame(() => {
      if (dragNode.current) {
        dragNode.current.style.opacity = "0.4";
      }
    });
  }, [items, canDrag]);

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragIndex === null || dragIndex === index) return;
    setOverIndex(index);
  }, [dragIndex]);

  const handleDragEnter = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === index) return;
    setOverIndex(index);
  }, [dragIndex]);

  const handleDragLeave = useCallback(() => {
    // Don't clear overIndex here to prevent flicker
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === index) {
      setDragIndex(null);
      setOverIndex(null);
      return;
    }

    const reordered = [...items];
    const [moved] = reordered.splice(dragIndex, 1);
    reordered.splice(index, 0, moved);
    onReorder(reordered);

    setDragIndex(null);
    setOverIndex(null);
    if (dragNode.current) {
      dragNode.current.style.opacity = "1";
      dragNode.current = null;
    }
  }, [dragIndex, items, onReorder]);

  const handleDragEnd = useCallback(() => {
    setDragIndex(null);
    setOverIndex(null);
    if (dragNode.current) {
      dragNode.current.style.opacity = "1";
      dragNode.current = null;
    }
  }, []);

  const getDragProps = useCallback((index: number) => {
    const isDraggable = !canDrag || canDrag(items[index], index);
    return {
      draggable: isDraggable,
      onDragStart: (e: React.DragEvent) => handleDragStart(e, index),
      onDragOver: (e: React.DragEvent) => handleDragOver(e, index),
      onDragEnter: (e: React.DragEvent) => handleDragEnter(e, index),
      onDragLeave: handleDragLeave,
      onDrop: (e: React.DragEvent) => handleDrop(e, index),
      onDragEnd: handleDragEnd,
    };
  }, [items, canDrag, handleDragStart, handleDragOver, handleDragEnter, handleDragLeave, handleDrop, handleDragEnd]);

  const getItemStyle = useCallback((index: number): React.CSSProperties => {
    const isDragging = dragIndex === index;
    const isOver = overIndex === index && dragIndex !== index;
    return {
      opacity: isDragging ? 0.4 : 1,
      borderTop: isOver && dragIndex !== null && index < dragIndex ? "2px solid var(--accent, #C8F26A)" : undefined,
      borderBottom: isOver && dragIndex !== null && index > dragIndex ? "2px solid var(--accent, #C8F26A)" : undefined,
      cursor: isDragging ? "grabbing" : "grab",
      transition: "border-color 0.15s ease",
    };
  }, [dragIndex, overIndex]);

  return { getDragProps, getItemStyle, isDragging: dragIndex !== null };
}
