export class GestureHandler {
  private startX = 0;
  private startY = 0;
  private startTime = 0;
  private minSwipeDistance = 50;
  private maxSwipeTime = 500;

  onSwipeLeft: (() => void) | null = null;
  onSwipeRight: (() => void) | null = null;
  onDoubleTap: (() => void) | null = null;
  onTap: (() => void) | null = null;

  private lastTapTime = 0;
  private lastTapX = 0;
  private lastTapY = 0;
  private doubleTapThreshold = 300;
  private doubleTapDistance = 50;

  constructor(element: HTMLElement) {
    element.addEventListener('touchstart', this.handleTouchStart.bind(this), false);
    element.addEventListener('touchend', this.handleTouchEnd.bind(this), false);
    element.addEventListener('touchmove', this.handleTouchMove.bind(this), false);
  }

  private handleTouchStart(event: TouchEvent): void {
    const touch = event.touches[0];
    this.startX = touch.clientX;
    this.startY = touch.clientY;
    this.startTime = Date.now();
  }

  private handleTouchMove(event: TouchEvent): void {
    // Prevent default scrolling during swipe
    if (Math.abs(event.touches[0].clientX - this.startX) > 10) {
      event.preventDefault();
    }
  }

  private handleTouchEnd(event: TouchEvent): void {
    const endX = event.changedTouches[0].clientX;
    const endY = event.changedTouches[0].clientY;
    const endTime = Date.now();

    const diffX = endX - this.startX;
    const diffY = endY - this.startY;
    const timeDiff = endTime - this.startTime;

    // Check for swipe
    if (
      Math.abs(diffX) > this.minSwipeDistance &&
      Math.abs(diffY) < this.minSwipeDistance &&
      timeDiff < this.maxSwipeTime
    ) {
      if (diffX > 0) {
        this.onSwipeRight?.();
      } else {
        this.onSwipeLeft?.();
      }
      return;
    }

    // Check for double tap
    const now = Date.now();
    const timeSinceLastTap = now - this.lastTapTime;
    const distanceFromLastTap = Math.sqrt(
      Math.pow(endX - this.lastTapX, 2) + Math.pow(endY - this.lastTapY, 2)
    );

    if (
      timeSinceLastTap < this.doubleTapThreshold &&
      distanceFromLastTap < this.doubleTapDistance
    ) {
      this.onDoubleTap?.();
      this.lastTapTime = 0; // Reset to prevent triple tap
    } else {
      this.onTap?.();
      this.lastTapTime = now;
      this.lastTapX = endX;
      this.lastTapY = endY;
    }
  }
}
