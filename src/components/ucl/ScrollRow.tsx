import { useEffect, useRef, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  className?: string;
}

/**
 * A single-line row of chips that scrolls sideways.
 *
 * Touch devices swipe this for free; a mouse cannot, because a vertical wheel
 * does nothing to a horizontally overflowing element and the scrollbar is
 * hidden. So a vertical wheel is translated into horizontal movement, and the
 * page keeps the scroll only once this row has reached its end - otherwise the
 * wheel would trap the page whenever the pointer crossed a row.
 *
 * The listener is attached by hand rather than with onWheel because React
 * registers wheel at the root as passive, which makes preventDefault() a no-op.
 */
const ScrollRow = ({ children, className = '' }: Props) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      if (el.scrollWidth <= el.clientWidth) return;
      // A trackpad already sends horizontal deltas; leave those alone.
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;

      const atStart = el.scrollLeft <= 0;
      const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 1;
      if ((e.deltaY < 0 && atStart) || (e.deltaY > 0 && atEnd)) return;

      e.preventDefault();
      el.scrollLeft += e.deltaY;
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  return (
    <div
      ref={ref}
      className={`no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto overscroll-x-contain px-1 py-0.5 ${className}`}
    >
      {children}
    </div>
  );
};

export default ScrollRow;
