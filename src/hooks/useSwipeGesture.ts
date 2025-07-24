import { useEffect, useRef, useState } from 'react';

interface SwipeHandlers {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
}

interface SwipeConfig {
  minSwipeDistance?: number;
  swipeVelocityThreshold?: number;
  preventDefaultTouchmoveEvent?: boolean;
  trackTouch?: boolean;
}

export function useSwipeGesture(
  handlers: SwipeHandlers,
  config: SwipeConfig = {}
) {
  const {
    minSwipeDistance = 50,
    swipeVelocityThreshold = 0.5,
    preventDefaultTouchmoveEvent = false,
    trackTouch = true
  } = config;

  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);
  const [touchEnd, setTouchEnd] = useState<{ x: number; y: number } | null>(null);
  const [swiping, setSwiping] = useState(false);
  const startTime = useRef<number>(0);

  useEffect(() => {
    const handleTouchStart = (e: TouchEvent) => {
      if (!trackTouch) return;
      
      const touch = e.targetTouches[0];
      setTouchStart({ x: touch.clientX, y: touch.clientY });
      setSwiping(true);
      startTime.current = Date.now();
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!trackTouch || !touchStart) return;
      
      if (preventDefaultTouchmoveEvent) {
        e.preventDefault();
      }
      
      const touch = e.targetTouches[0];
      setTouchEnd({ x: touch.clientX, y: touch.clientY });
    };

    const handleTouchEnd = () => {
      if (!touchStart || !touchEnd) {
        setSwiping(false);
        return;
      }

      const deltaX = touchStart.x - touchEnd.x;
      const deltaY = touchStart.y - touchEnd.y;
      const deltaTime = Date.now() - startTime.current;
      const velocity = Math.abs(deltaX) / deltaTime;

      // Determine if it's a horizontal or vertical swipe
      const isHorizontalSwipe = Math.abs(deltaX) > Math.abs(deltaY);

      if (isHorizontalSwipe) {
        // Horizontal swipe
        if (Math.abs(deltaX) > minSwipeDistance && velocity > swipeVelocityThreshold) {
          if (deltaX > 0) {
            handlers.onSwipeLeft?.();
          } else {
            handlers.onSwipeRight?.();
          }
        }
      } else {
        // Vertical swipe
        if (Math.abs(deltaY) > minSwipeDistance && velocity > swipeVelocityThreshold) {
          if (deltaY > 0) {
            handlers.onSwipeUp?.();
          } else {
            handlers.onSwipeDown?.();
          }
        }
      }

      // Reset states
      setTouchStart(null);
      setTouchEnd(null);
      setSwiping(false);
    };

    // Add event listeners
    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: !preventDefaultTouchmoveEvent });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });

    // Cleanup
    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [touchStart, touchEnd, handlers, minSwipeDistance, swipeVelocityThreshold, preventDefaultTouchmoveEvent, trackTouch]);

  return { swiping };
}

// Hook specifically for navigation swipes
export function useNavigationSwipe(
  onNext: () => void,
  onPrevious: () => void,
  enabled = true
) {
  return useSwipeGesture(
    {
      onSwipeLeft: onNext,
      onSwipeRight: onPrevious,
    },
    {
      minSwipeDistance: 75,
      swipeVelocityThreshold: 0.3,
      trackTouch: enabled,
    }
  );
}