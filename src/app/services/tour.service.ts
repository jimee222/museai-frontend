import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class TourService {

  private points: any[] = [];

  active: boolean = false;
  paused: boolean = false;

  current: number = 0;

  constructor() {}

  setup(points: any[]) {
    this.points = points;
    this.current = 0;
  }

  start() {
    this.active = true;
    this.paused = false;
    this.current = 0;
  }

  startFrom(index: number) {
    this.active = true;
    this.paused = false;

    if (index < 0 || index >= this.points.length) {
      index = 0;
    }

    this.current = index;
  }

  stop() {
    this.active = false;
    this.paused = false;
    this.current = 0;
  }

  pause() {
    this.paused = true;
  }

  resume() {
    this.paused = false;
  }
  restart() {
    if (!this.points || this.points.length === 0) return;

    this.active = true;
    this.paused = false;

    this.current = 0;

    localStorage.removeItem('tour-progress');
  }



  next() {
    if (!this.active) return;

  if (this.current === this.points.length - 1) {
      localStorage.removeItem('tour-progress');
      this.onTourFinished?.();
      return;
  }
  this.current++;
  }

  prev() {
    if (!this.active) return;

    if (this.current > 0) {
      this.current--;
    }
  }

  currentPoint() {
    return this.points[this.current];
  }

  currentIndex() {
    return this.current;
  }

  isActive() {
    return this.active;
  }

  isPaused() {
    return this.paused;
  }
    onTourFinished?: () => void;

}
