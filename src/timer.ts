import { addWithOneByte } from './utils';

export abstract class GBTimer {
  abstract inc(mClock: number): void;
}

export class GBTimerImpl extends GBTimer {
  #tick = 0;
  #registers = {
    divider: 0, // 1/16 of base speed
    counter: 0, // programmable speed
    modulo: 0, // reset val of counter when overflowed
    control: 0, // control counter speed and if timer runs
  };

  #accumulatedTime = {
    tick: 0,
    divider: 0,
    counter: 0,
  };

  constructor(modulo: number, control: number) {
    super();
    this.#registers.modulo = modulo;
    this.#registers.control = control;
  }

  get counterSpeedFactor() {
    const firstTwoBit = this.#registers.control & 0b11;
    switch (firstTwoBit) {
      case 0b00:
        return 64;
      case 0b01:
        return 1;
      case 0b10:
        return 4;
      case 0b11:
        return 16;
      default:
        throw new Error('unreachable!');
    }
  }

  inc(mClock: number): void {
    this.#accumulatedTime.tick += mClock;
    this.#accumulatedTime.divider += mClock;
    this.#accumulatedTime.counter += mClock;

    if (this.#accumulatedTime.tick >= 4) {
      this.#tick++;
      this.#accumulatedTime.tick -= 4;
    }

    if (this.#accumulatedTime.divider >= 16) {
      this.#registers.divider = addWithOneByte(this.#registers.divider, 1);
      this.#accumulatedTime.divider -= 16;
    }

    const counterSpeedFactor = this.counterSpeedFactor;
    if (this.#accumulatedTime.counter >= counterSpeedFactor) {
      const increasement = Math.floor(
        this.#accumulatedTime.counter / counterSpeedFactor
      );
      const left = this.#accumulatedTime.counter % counterSpeedFactor;
      this.#registers.counter += increasement;
      this.#accumulatedTime.counter = left;
    }
  }
}
