import { MMU } from './cpu';
import {
  DIV_ADDR,
  TIMA_ADDR,
  TMA_ADDR,
  TAC_ADDR,
  IF_ADDR,
  InterruptBit,
} from './const';
import { getBit, setBit } from './utils';

export abstract class GBTimer {
  abstract inc(mClock: number): void;
}

export class GBTimerImpl extends GBTimer {
  stopped = false;
  #memory: MMU;
  #mLeft = 0;

  constructor(memory: MMU) {
    super();
    this.#memory = memory;
    this.DIV = memory.readByte(DIV_ADDR);
    this.TIMA = memory.readByte(TIMA_ADDR);
    this.TAC = memory.readByte(TAC_ADDR);
    this.TMA = memory.readByte(TMA_ADDR);
  }

  inc(mClock: number): void {
    if (!this.stopped) {
      // todo: check if div is necessary
    }

    const TIMASpeed = this.TIMASpeed;

    if (TIMASpeed === 0) {
      return;
    }

    const mLeft = this.#mLeft + mClock;
    const TIMAIncreasement = Math.floor(mLeft / TIMASpeed);
    this.#mLeft = mLeft % TIMASpeed;
    const TIMA = this.TIMA;
    const newTIMA = TIMA + TIMAIncreasement;
    if (newTIMA > 0xff) {
      // interrupt
      this.#memory.writeByte(
        IF_ADDR,
        setBit(this.#memory.readByte(IF_ADDR), InterruptBit.TIMER, 1)
      );
      this.TIMA = this.TMA;
    } else {
      this.TIMA = newTIMA;
    }
  }

  // 64 * m-clock = 1 * DIV
  private get DIV() {
    return this.#memory.readByte(DIV_ADDR);
  }

  private set DIV(val: number) {
    this.#memory.writeDIV(val);
  }

  private get TIMA() {
    return this.#memory.readByte(TIMA_ADDR);
  }

  private set TIMA(val: number) {
    this.#memory.writeByte(TIMA_ADDR, val);
  }

  private get TMA() {
    return this.#memory.readByte(TMA_ADDR);
  }

  private set TMA(val: number) {
    this.#memory.writeByte(TMA_ADDR, val);
  }

  private get TAC() {
    return this.#memory.readByte(TAC_ADDR);
  }

  private set TAC(val: number) {
    this.#memory.writeByte(TAC_ADDR, val);
  }

  // speed * m-clock = 1 * TIMA
  private get TIMASpeed() {
    const TAC = this.TAC;
    if (getBit(TAC, 2) === 0) {
      return 0;
    }
    switch (TAC & 0b11) {
      case 0b00:
        return 256;
      case 0b01:
        return 4;
      case 0b10:
        return 16;
      case 0b11:
        return 64;
      default:
        throw new Error('unreachable!');
    }
  }
}
