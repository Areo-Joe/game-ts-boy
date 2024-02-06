import {
  memoryDivisionSizeMap,
  MemoryDivision,
  memoryDivisions,
} from './consts';
import { transformAddr } from './utils';
import { DIV_ADDR } from '../const';
import { MemoryRegister } from '../mRegisters';
import { allOnes } from '../utils';

let logStr = '';

export abstract class MMU {
  abstract readByte(addr: number): number;
  abstract writeByte(addr: number, val: number): void;

  abstract readDoubleByte(addr: number): number;
  abstract writeDoubleByte(addr: number, val: number): void;

  abstract loadRom(rom: Uint8Array): void;
}

export class GameBoyMMU extends MMU {
  #rom: Uint8Array | null = null;
  #videoRAM = new Uint8Array(
    memoryDivisionSizeMap.get(MemoryDivision.videoRAM)!
  );
  #workRAM = new Uint8Array(memoryDivisionSizeMap.get(MemoryDivision.workRAM)!);
  #OAM = new Uint8Array(
    memoryDivisionSizeMap.get(MemoryDivision.objectAttributeMemory)!
  );
  #IO = new Uint8Array(memoryDivisionSizeMap.get(MemoryDivision.IO)!);
  #highRAM = new Uint8Array(memoryDivisionSizeMap.get(MemoryDivision.highRAM)!);
  #IE = 0;

  constructor() {
    super();
  }

  readByte(addr: number): number {
    const [division, index] = transformAddr(addr);
    switch (division) {
      // internal usable area
      case MemoryDivision.videoRAM:
        return this.#videoRAM[index];
      case MemoryDivision.workRAM:
        return this.#workRAM[index];
      case MemoryDivision.objectAttributeMemory:
        return this.#OAM[index];
      case MemoryDivision.IO:
        switch (addr) {
          case MemoryRegister.SB:
          case MemoryRegister.DIV:
          case MemoryRegister.TIMA:
          case MemoryRegister.TMA:
            return this.#IO[index]; // read full bits, no need to handle
          case MemoryRegister.TAC:
            return (this.#IO[index] & allOnes(3)) | (allOnes(5) << 3);
          case MemoryRegister.IF:
            return (this.#IO[index] & allOnes(5)) | (allOnes(3) << 5);
          case MemoryRegister.LY:
            return 0x90; // todo: check this hardcode
          case MemoryRegister.IE:
            return (this.#IO[index] & allOnes(5)) | (allOnes(3) << 5);
          default:
            return 0xff; // todo: now temply makes unhandled IO register 0xff
        }
      case MemoryDivision.highRAM:
        return this.#highRAM[index];
      case MemoryDivision.IE:
        return this.#IE;
      // cart
      case MemoryDivision.fixedCartROM:
        // now we only impl NO MBC
        return addr < this.#rom!.length ? this.#rom![addr] : 0xff; // todo: check undefined behavior
      case MemoryDivision.cartRAM:
        return 0xff; // todo: check undefined behavior
      default:
        throw new Error('unimpl');
    }
  }
  readDoubleByte(addr: number): number {
    const lower = this.readByte(addr);
    const higher = this.readByte(addr + 1);
    return (higher << 8) + lower;
  }

  writeByte(addr: number, val: number): void {
    const [division, index] = transformAddr(addr);
    switch (division) {
      // internal usable area
      case MemoryDivision.videoRAM:
        this.#videoRAM[index] = val;
      case MemoryDivision.workRAM:
        this.#workRAM[index] = val;
      case MemoryDivision.objectAttributeMemory:
        this.#OAM[index] = val;
      case MemoryDivision.IO:
        this.#IO[index] = val;
      case MemoryDivision.highRAM:
        this.#highRAM[index] = val;
      case MemoryDivision.IE:
        this.#IE = val;
      // cart
      case MemoryDivision.fixedCartROM:
        return; // readonly
      case MemoryDivision.cartRAM:
        return; // readonly
      default:
        throw new Error('unimpl');
    }
  }

  writeDoubleByte(addr: number, val: number): void {
    const lower = val & 0xff;
    const higher = (val >> 8) & 0xff;

    this.writeByte(addr, lower);
    this.writeByte(addr + 1, higher);
  }

  loadRom(rom: Uint8Array): void {
    this.#rom = rom;
  }
}
