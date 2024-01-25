import { MMU } from './cpu';
import { DIV_ADDR, TIMA_ADDR, TMA_ADDR, TAC_ADDR } from './const';

export abstract class GBTimer {
  abstract inc(mClock: number): void;
}

export class GBTimerImpl extends GBTimer {
  #memory: MMU;

  constructor(modulo: number, control: number, memory: MMU) {
    super();
    this.#memory = memory;
  }

  inc(mClock: number): void {
    throw new Error('unimplemented!');
  }

  private get DIV() {
    return this.#memory.readByte(DIV_ADDR);
  }

  private set DIV(val: number) {
    this.#memory.writeByte(DIV_ADDR, val);
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
}
