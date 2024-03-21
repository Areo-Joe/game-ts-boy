import { InterruptBit } from '../interruptConst';
import { MemoryRegister } from '../mRegisters';
import { setBit } from '../utils';
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
    } else if (addr <= 0xfeff) {
      // OAM, UNUSABLE
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
    } else if (addr <= 0xfeff) {
      // OAM, UNUSABLE

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
        case MemoryRegister.LY:
          return; // todo: check this hardcode
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
}
