import { InterruptBit } from '../interruptConst';
import { MemoryRegister } from '../mRegisters';
import { getBit, setBit } from '../utils';
import { MMUTimerHooks, Timer } from '../timer';

let logStr = '';

function validateAddr(addr: number) {
  if (addr < 0 || addr >= 0x10000) {
    throw new Error(`invalid addr: ${addr.toString(16)}`);
  }
}

export enum MMUMode {
  DEBUG,
  PROD,
}

export class GameBoyMMU {
  #memory = new Uint8Array(0x10000);
  #timer: Timer | null = null;

  spendTime: null | ((mClock: number) => void) = null;
  setSpendTime(fn: (mClock: number) => void) {
    this.spendTime = fn;
  }

  STATInterruptLine = false;

  constructor(timer?: Timer) {
    timer && (this.#timer = timer);
  }

  setTimer(timer: Timer) {
    this.#timer = timer;
  }

  readByte(addr: number): number {
    validateAddr(addr);

    if (addr <= 0xdfff) {
      // ROM, RAM
      return this.#memory[addr];
    } else if (addr <= 0xfdff) {
      // mirror ram
      return this.#memory[addr - 0x2000];
    } else if (addr <= 0xfe9f) {
      // OAM
      return this.#memory[addr];
    } else if (addr <= 0xfeef) {
      // UNUSABLE
      return this.#memory[addr];
    } else if (addr <= 0xff7f) {
      // IO

      if (addr === MemoryRegister.LY) {
        return 0x90; // todo: check hardcode
      }
      return this.#memory[addr];
    } else {
      // high RAM, IE
      return this.#memory[addr];
    }
  }
  readDoubleByte(addr: number): number {
    const lower = this.readByte(addr);
    const higher = this.readByte(addr + 1);
    return (higher << 8) + lower;
  }

  writeByte(addr: number, val: number): void {
    validateAddr(addr);
    const timer = this.#timer!;

    if (addr <= 0x7fff) {
      // ROM

      return;
    } else if (addr <= 0xdfff) {
      // RAM

      this.#memory[addr] = val;
      return;
    } else if (addr <= 0xfdff) {
      // mirror RAM

      this.#memory[addr - 0x2000] = val;
      return;
    } else if (addr <= 0xfe9f) {
      // OAM

      this.#memory[addr] = val;
      return;
    } else if (addr <= 0xfeff) {
      // UNUSABLE

      this.#memory[addr] = val;
      return;
    } else if (addr <= 0xff7f) {
      // IO

      if (addr === MemoryRegister.SB) {
        const char = String.fromCharCode(val);
        logStr += char;
        console.log(logStr);
      }

      switch (addr) {
        case MemoryRegister.SB:
        case MemoryRegister.SC:
          this.#memory[addr] = val;
          return;
        case MemoryRegister.DIV:
          this.#memory[addr] = 0;
          timer.resetSystemCounter();
          return;
        case MemoryRegister.TIMA:
        case MemoryRegister.TMA:
          this.#memory[addr] = val;
          return;
        case MemoryRegister.TAC:
          this.#memory[addr] = val;
          timer.check();
          return;
        case MemoryRegister.IF:
          this.#memory[addr] = val;
          return;
        case MemoryRegister.STAT:
          const oldSTAT = this.readByte(MemoryRegister.STAT);
          const finalVal = (val & 0b1111_1000) | (oldSTAT & 0b111); // The first 3 bit is readonly
          this.#memory[addr] = finalVal;
          this.updateSTATInterruptLine();
          return;
        case MemoryRegister.LY:
          // LY is readonly, it is writable only to GPU
          return;
        case MemoryRegister.LYC:
          this.#memory[addr] = val;
          const LY = this.readByte(MemoryRegister.LY);
          const currentSTAT = this.readByte(MemoryRegister.STAT);
          this.#memory[MemoryRegister.STAT] = setBit(
            currentSTAT,
            2,
            val === LY ? 1 : 0
          );
          this.updateSTATInterruptLine();
          return;
        case MemoryRegister.DMA:
          this.#memory[addr] = val;

          if (0x00 <= val && val <= 0xdf) {
            // start a DMA transfer
            const sourceStart = val << 8;
            const destStart = 0xfe00;
            for (let i = 0; i <= 0x9f; i++) {
              this.#memory[destStart + i] = this.#memory[sourceStart + i];
            }
            this.spendTime!(160);
          }

          return;
        default:
          this.#memory[addr] = val;
          return;
      }
    } else {
      // high RAM, IE
      this.#memory[addr] = val;
    }
  }

  writeDoubleByte(addr: number, val: number): void {
    const lower = val & 0xff;
    const higher = (val >> 8) & 0xff;

    this.writeByte(addr, lower);
    this.writeByte(addr + 1, higher);
  }

  loadRom(rom: Uint8Array): void {
    for (let i = 0; i < rom.length; i++) {
      this.#memory[i] = rom[i];
    }
  }

  setInterrupt(bitIndex: InterruptBit, bool: boolean) {
    const oldIF = this.readByte(MemoryRegister.IF);
    const newIF = setBit(oldIF, bitIndex, bool ? 1 : 0);
    this.writeByte(MemoryRegister.IF, newIF);
  }

  /**
   * Calculate the latest STAT interrupt line based on current state and update it.
   * If the update cause a rising edge, an interrupt should be fired.
   * The function should be called after any operation that may possibly change the STAT interrupt line:
   * - write to STAT register
   * - write to LYC register thus change STAT.2
   * - PPU scanline change thus change LY and then STAT.2
   * - PPU mode change thus change LCDC[0,1]
   */
  updateSTATInterruptLine() {
    const STAT = this.#memory[MemoryRegister.STAT];
    const LYEqLYC = getBit(STAT, 2) === 1;
    const GPUMode = (getBit(STAT, 1) << 1) + getBit(STAT, 0);
    const newSTATInterruptLine =
      (getBit(STAT, 6) === 1 && LYEqLYC) ||
      (getBit(STAT, 5) === 1 && GPUMode == 2) ||
      (getBit(STAT, 4) === 1 && GPUMode == 1) ||
      (getBit(STAT, 3) === 1 && GPUMode == 0);
    if (this.STATInterruptLine === false && newSTATInterruptLine) {
      this.setInterrupt(InterruptBit.LCD, true);
    }
    this.STATInterruptLine = newSTATInterruptLine;
  }

  timerHooks: MMUTimerHooks = {
    getDIV: () => this.readByte(MemoryRegister.DIV),
    setDIV: (val) => {
      this.#memory[MemoryRegister.DIV] = val;
    },
    getTAC: () => this.readByte(MemoryRegister.TAC),
    getTIMA: () => this.readByte(MemoryRegister.TIMA),
    getTMA: () => this.readByte(MemoryRegister.TMA),
    setTIMA: (val) => {
      this.#memory[MemoryRegister.TIMA] = val;
    },
    triggerTimerInterrupt: () => {
      this.setInterrupt(InterruptBit.TIMER, true);
    },
  };

  GPUHooks: MMUGPUHooks = {
    getSTAT: () => this.readByte(MemoryRegister.STAT),
    setSTAT: (val: number) => {
      this.#memory[MemoryRegister.STAT] = val;
      this.updateSTATInterruptLine();
    },
    getLCDC: () => this.readByte(MemoryRegister.LCDC),
    getSCX: () => this.readByte(MemoryRegister.SCX),
    getSCY: () => this.readByte(MemoryRegister.SCY),
    getBGP: () => this.readByte(MemoryRegister.BGP),
    getWY: () => this.readByte(MemoryRegister.WY),
    getWX: () => this.readByte(MemoryRegister.WX),
    getLY: () => this.readByte(MemoryRegister.LY),
    setLY: (val: number) => {
      // LY is readonly so we need to provide a way for GPU to change that
      this.#memory[MemoryRegister.LY] = val;

      // update STAT.2
      const LYC = this.readByte(MemoryRegister.LYC);
      const STAT = this.readByte(MemoryRegister.STAT);
      const newSTAT = setBit(STAT, 2, LYC === val ? 1 : 0);

      // manually set STAT, whose first 2 bits are readonly
      this.#memory[MemoryRegister.STAT] = newSTAT;
      this.updateSTATInterruptLine();
    },
    triggerVBlankInterrupt: () => {
      this.setInterrupt(InterruptBit.V_BLANK, true);
    },
  };
}

interface MMUGPUHooks {
  getSTAT: () => number;
  setSTAT: (val: number) => void;
  getLCDC: () => number;
  getSCX: () => number;
  getSCY: () => number;
  getBGP: () => number;
  getWY: () => number;
  getWX: () => number;
  getLY: () => number;
  setLY: (val: number) => void;
  triggerVBlankInterrupt: VoidFunction;
}
