import { useState, useRef, useCallback, useEffect } from "react";

interface UseDragReorderOptions<T> {
  items: T[];
  onReorder: (reordered: T[]) => void;
  canDrag?: (item: T, index: number) => boolean;
}

export function useDragReorder<T>({ items, onReorder, canDrag }: UseDragReorderOptions<T>) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const dragNode = useRef<HTMLElement | null>(null);
  // Touch state (HTML5 drag events don't fire on mobile)
  const touchDragIndex = useRef<number | null>(null);
  const touchOverIndex = useRef<number | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartXY = useRef<{ x: number; y: number } | null>(null);
  const itemsRef = useRef(items);
  useEffect(() => { itemsRef.current = items; }, [items]);

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

  // ----- Touch handlers (mobile) -----
  const clearLongPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const findIndexFromPoint = (x: number, y: number): number | null => {
    const el = document.elementFromPoint(x, y) as HTMLElement | null;
    if (!el) return null;
    const target = el.closest<HTMLElement>("[data-drag-index]");
    if (!target) return null;
    const idx = Number(target.dataset.dragIndex);
    return Number.isFinite(idx) ? idx : null;
  };

  const handleTouchStart = useCallback((e: React.TouchEvent, index: number) => {
    if (canDrag && !canDrag(itemsRef.current[index], index)) return;
    const t = e.touches[0];
    touchStartXY.current = { x: t.clientX, y: t.clientY };
    clearLongPress();
    longPressTimer.current = setTimeout(() => {
      touchDragIndex.current = index;
      setDragIndex(index);
      // haptic
      if ("vibrate" in navigator) navigator.vibrate?.(20);
    }, 220);
  }, [canDrag]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    const t = e.touches[0];
    // Cancel long-press if the finger moves before activation
    if (touchDragIndex.current === null) {
      if (touchStartXY.current) {
        const dx = t.clientX - touchStartXY.current.x;
        const dy = t.clientY - touchStartXY.current.y;
        if (Math.hypot(dx, dy) > 8) clearLongPress();
      }
      return;
    }
    // Active drag — prevent page scroll and update target
    e.preventDefault();
    const idx = findIndexFromPoint(t.clientX, t.clientY);
    if (idx !== null && idx !== touchDragIndex.current) {
      touchOverIndex.current = idx;
      setOverIndex(idx);
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    clearLongPress();
    const from = touchDragIndex.current;
    const to = touchOverIndex.current;
    touchDragIndex.current = null;
    touchOverIndex.current = null;
    touchStartXY.current = null;
    setDragIndex(null);
    setOverIndex(null);
    if (from === null || to === null || from === to) return;
    const reordered = [...itemsRef.current];
    const [moved] = reordered.splice(from, 1);
    reordered.splice(to, 0, moved);
    onReorder(reordered);
  }, [onReorder]);

  const getDragProps = useCallback((index: number) => {
    const isDraggable = !canDrag || canDrag(items[index], index);
    return {
      draggable: isDraggable,
      "data-drag-index": index,
      onDragStart: (e: React.DragEvent) => handleDragStart(e, index),
      onDragOver: (e: React.DragEvent) => handleDragOver(e, index),
      onDragEnter: (e: React.DragEvent) => handleDragEnter(e, index),
      onDragLeave: handleDragLeave,
      onDrop: (e: React.DragEvent) => handleDrop(e, index),
      onDragEnd: handleDragEnd,
      onTouchStart: (e: React.TouchEvent) => handleTouchStart(e, index),
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd,
      onTouchCancel: handleTouchEnd,
      style: { touchAction: dragIndex !== null ? "none" : "manipulation" } as React.CSSProperties,
    };
  }, [items, canDrag, dragIndex, handleDragStart, handleDragOver, handleDragEnter, handleDragLeave, handleDrop, handleDragEnd, handleTouchStart, handleTouchMove, handleTouchEnd]);

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
