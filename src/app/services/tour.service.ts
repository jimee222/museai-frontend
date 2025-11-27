import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class TourService {

  private points: { x: number; y: number; z: number; rotY: number }[] = [];
  private index = 0;

  private active = new BehaviorSubject<boolean>(false);
  private paused = new BehaviorSubject<boolean>(false);

  tourActive$ = this.active.asObservable();
  tourPaused$ = this.paused.asObservable();

  setup(points: { x: number; y: number; z: number; rotY: number }[]) {
    this.points = points;
  }

  start() {
    this.index = 0;
    this.active.next(true);
    this.paused.next(false);
  }

  pause() {
    this.paused.next(true);
  }

  resume() {
    this.paused.next(false);
  }

  restart() {
    this.index = 0;
    this.paused.next(false);
  }

  stop() {
    this.active.next(false);
    this.paused.next(false);
  }

  next() {
    if (this.index < this.points.length - 1) this.index++;
  }

  prev() {
    if (this.index > 0) this.index--;
  }

  currentPoint() {
    return this.points[this.index];
  }

  currentIndex(): number {
    return this.index;
  }

  isActive() {
    return this.active.value;
  }

  isPaused() {
    return this.paused.value;
  }
}
