// GB's cpu is a modified Z80, so...
class Z80 {
  #memory: MMU;

  constructor(mmu: MMU) {
    this.#memory = mmu;
  }

  #registers = {
    // for computation
    a: 0,
    b: 0,
    c: 0,
    d: 0,
    e: 0,
    h: 0,
    l: 0,

    f: 0, // flag,
    sp: 0, // stack pointer
    pc: 0, // program counter
  };

  #clock = {
    last: 0, // time to run last instruction
    total: 0, // time total
  };

  #opMap = [
    // 1st
    this.NOP,
    this.LD_BC_d16,
    this.LD_BCa_A,
    this.INC_BC,
    this.INC_B,
    this.DEC_B,
    this.LD_B_d8,
    this.RLCA,

    this.LD_d16a_SP,
    this.ADD_HL_BC,
  ];

  run() {
    while (true) {
      const opcode = this.readFromPcAndIncPc();
      this.#opMap[opcode]();
    }
  }

  reset() {
    (['register', 'clock'] as Array<keyof this>).forEach((resetKey) => {
      Object.keys(this[resetKey] as Record<string, number>).forEach(
        (key) => ((this[resetKey] as Record<string, number>)[key] = 0)
      );
    });
  }

  clearFlag() {
    this.#registers.f = 0;
  }

  private joinRegisterPair(
    higherByte: Z80Registers,
    lowerByte: Z80Registers
  ): number {
    return (this.#registers[higherByte] << 8) + this.#registers[lowerByte];
  }

  private distributeToRegisterPair(
    higherByte: Z80Registers,
    lowerByte: Z80Registers,
    val: number
  ) {
    this.#registers[lowerByte] = val & 0xff;
    this.#registers[higherByte] = (val >> 8) & 0xff;
  }

  private setZeroFlag(bool: boolean) {
    if (bool) {
      this.#registers.f |= 0x80;
    } else {
      this.#registers.f &= 0xff ^ 0x80;
    }
  }

  private setSubstractionFlag(bool: boolean) {
    if (bool) {
      this.#registers.f |= 0x40;
    } else {
      this.#registers.f &= 0xff ^ 0x40;
    }
  }

  private setHalfCarryFlag(bool: boolean) {
    if (bool) {
      this.#registers.f |= 0x20;
    } else {
      this.#registers.f &= 0xff ^ 0x20;
    }
  }

  private setCarryFlag(bool: boolean) {
    if (bool) {
      this.#registers.f |= 0x10;
    } else {
      this.#registers.f &= 0xff ^ 0x10;
    }
  }

  private pcInc() {
    this.#registers.pc++;
  }

  private readFromPc() {
    return this.#memory.readByte(this.#registers.pc);
  }

  private readFromPcAndIncPc() {
    const ret = this.readFromPc();
    this.pcInc();
    return ret;
  }

  // ***** THE FUNCTIONS BELOW ARE OPCODES!!! *****

  // ***** [1st 8 ops] [0x00 - 0x07] starts *****

  private NOP() {}

  private LD_BC_d16() {
    const lowerByte = this.readFromPcAndIncPc();
    const higherByte = this.readFromPcAndIncPc();
    this.#registers.b = higherByte;
    this.#registers.c = lowerByte;
  }

  private LD_BCa_A() {
    let addr = this.joinRegisterPair('b', 'c');
    this.#memory.writeByte(addr, this.#registers.a);
  }

  private INC_BC() {
    let val = this.joinRegisterPair('b', 'c');
    this.distributeToRegisterPair('b', 'c', (val + 1) & 0xffff);
  }

  private INC_B() {
    let val = this.#registers.b;
    let result = (val + 1) & 0xff;
    this.#registers.b = result;
    this.setZeroFlag(shouldSetZeroFlag(result));
    this.setSubstractionFlag(false);
    this.setHalfCarryFlag(
      shouldSetHalfCarryFlag(val, 1, Operation.Add, BitLength.OneByte)
    );
  }

  private DEC_B() {
    let val = this.#registers.b;
    let result = (val - 1) & 0xff;
    this.setZeroFlag(shouldSetZeroFlag(result));
    this.setSubstractionFlag(true);
    this.setHalfCarryFlag(
      shouldSetHalfCarryFlag(val, 1, Operation.Minus, BitLength.OneByte)
    );
  }

  private LD_B_d8() {
    this.#registers.b = this.readFromPcAndIncPc();
  }

  private RLCA() {
    const lastBit = (this.#registers.a & (0x1 << 7)) !== 0 ? 1 : 0;
    const leftOne = ((this.#registers.a & 0xff) << 1) & 0xff;
    const result = (leftOne & ~1) | lastBit;
    this.#registers.a = result;
    this.setCarryFlag(lastBit === 1);
  }

  // ***** [1st 8 ops] [0x00 - 0x07] ends *****

  // ***** [2nd 8 ops] [0x00 - 0x07] starts  *****

  private LD_d16a_SP() {
    const addrLB = this.readFromPcAndIncPc();
    const addrHB = this.readFromPcAndIncPc();
    const addr = ((addrHB << 8) & 0xff) + (0xff & addrLB);
    this.#memory.writeDoubleByte(addr, this.#registers.sp);
  }

  private ADD_HL_BC() {
    const bc = this.joinRegisterPair('b', 'c');
    const hl = this.joinRegisterPair('h', 'l');
    const result = (hl + bc) & 0xff;
    this.distributeToRegisterPair('h', 'l', result);
    this.setSubstractionFlag(false);
    this.setHalfCarryFlag(
      shouldSetHalfCarryFlag(hl, bc, Operation.Add, BitLength.DoubleByte)
    );
    this.setCarryFlag(
      shouldSetCarryFlag(hl, bc, Operation.Add, BitLength.DoubleByte)
    );
  }
}

export abstract class MMU {
  abstract readByte(addr: number): number;
  abstract writeByte(addr: number, val: number): void;

  abstract readDoubleByte(addr: number): number;
  abstract writeDoubleByte(addr: number, val: number): void;
}

type Z80Registers = 'a' | 'b' | 'c' | 'd' | 'e' | 'h' | 'l' | 'f' | 'sp' | 'pc';

enum Operation {
  Add,
  Minus,
}

enum BitLength {
  OneByte = 8,
  DoubleByte = 16,
}

function shouldSetZeroFlag(result: number) {
  return result === 0;
}

function shouldSetHalfCarryFlag(
  left: number,
  right: number,
  operation: Operation,
  bitLength: number
): boolean {
  assertEven(bitLength);
  const halfBitLength = bitLength / 2;
  return shouldSetCarryFlag(left, right, operation, halfBitLength);
}

function shouldSetCarryFlag(
  left: number,
  right: number,
  operation: Operation,
  bitLength: number
): boolean {
  const fullOnes = (1 << bitLength) - 1;

  const [leftWithLimitedBits, rightWithLimitedBits] = [left, right].map(
    (x) => x & fullOnes
  );

  if (operation === Operation.Add) {
    return (
      ((leftWithLimitedBits + rightWithLimitedBits) & (1 << bitLength)) !== 0
    );
  } else {
    return leftWithLimitedBits < rightWithLimitedBits;
  }
}

function assertEven(x: number) {
  if (x % 2 !== 0) {
    throw new Error(`${x} is not even!`);
  }
}
