import { shouldSetCarryFlag } from './cpu';
import {
  BitLength,
  Operation,
  allOnes,
  getBit,
  performOperationOnOperandsWithBitLength,
} from './utils';

export interface MMUTimerHooks {
  getDIV: () => number;
  setDIV: (val: number) => void;

  getTMA: () => number;

  getTIMA: () => number;
  setTIMA: (val: number) => void;

  getTAC: () => number;

  triggerTimerInterrupt: VoidFunction;
}

export class Timer {
  #hooks: MMUTimerHooks | null = null;
  #systemCounter = 0;
  #lastTimerEdge = false;

  constructor(hooks?: MMUTimerHooks) {
    hooks && (this.#hooks = hooks);
  }

  setHooks(hooks: MMUTimerHooks) {
    this.#hooks = hooks;
  }

  resetSystemCounter() {
    // this is triggered when DIV is written outside Timer
    // MMU will first set DIV to 0, so we don't need to do that here
    this.#systemCounter = 0;
    this.check();
  }

  increaseMClocks(m: number) {
    for (let i = 0; i < m; i++) {
      // 1. increase system counter
      // 2. check whether to tick
      this.increaseSystemCounter(1);
      this.check();
    }
  }

  check() {
    // 1. get the selected bit and timer enable bit
    // 2. perform and operation and do the falling edge check
    // 3. if so, tick
    // 4. do not forget to save the edge status so that next time we can do falling edge check
    const TAC = this.#hooks!.getTAC();
    const systemCounterSelectBitIndex = TAC2SystemCounterSelectBitIndex(TAC);
    const selectedSystemCounterBit = getBit(
      this.#systemCounter,
      systemCounterSelectBitIndex
    );
    const timerEnabled = getBit(TAC, 2);
    const currentTimerEdge = Boolean(timerEnabled & selectedSystemCounterBit);
    if (this.#lastTimerEdge && !currentTimerEdge) {
      this.tick();
    }
    this.#lastTimerEdge = currentTimerEdge;
  }

  tick() {
    // for simplicity, temply ignore the 1 m-clock latency
    const hooks = this.#hooks!;
    const TMA = hooks.getTMA();
    const TIMA = hooks.getTIMA();
    const newTIMA = performOperationOnOperandsWithBitLength(
      Operation.Add,
      BitLength.OneByte,
      TIMA,
      1
    );
    const overflow = shouldSetCarryFlag(
      Operation.Add,
      BitLength.OneByte,
      TIMA,
      1
    );
    if (overflow) {
      // 1. set TIMA to TMA
      // 2. trigger Timer interrupt
      hooks.setTIMA(TMA);
      hooks.triggerTimerInterrupt();
    } else {
      // 1. TIMA increase
      hooks.setTIMA(newTIMA);
    }
  }

  private increaseSystemCounter(m: number) {
    // increase the system counter and sync the DIV to MMU
    const result = performOperationOnOperandsWithBitLength(
      Operation.Add,
      14,
      this.#systemCounter,
      m
    );

    this.#systemCounter = result;
    this.#hooks!.setDIV(((allOnes(BitLength.OneByte) << 6) & result) >> 6);
  }
}

const TAC2SystemCounterSelectBitIndexMap = [7, 1, 3, 5];

function TAC2SystemCounterSelectBitIndex(TAC: number) {
  return TAC2SystemCounterSelectBitIndexMap[TAC & 0b11];
}
