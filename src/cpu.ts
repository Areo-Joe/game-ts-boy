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

    // 2nd
    this.LD_d16a_SP,
    this.ADD_HL_BC,
    this.LD_A_BCa,
    this.DEC_BC,
    this.INC_C,
    this.DEC_C,
    this.LD_C_d8,
    this.RRCA,

    // 3rd
    this.Stop,
    this.LD_DE_d16,
    this.LD_DEa_A,
    this.INC_DE,
    this.INC_D,
    this.DEC_D,
    this.LD_D_d8,
    this.RLA,

    // 4th
    this.JR_s8,
    this.ADD_HL_DE,
    this.LD_A_DEa,
    this.DEC_DE,
    this.INC_E,
    this.DEC_E,
    this.LD_E_d8,
    this.RRA,
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
    higherByte: Z80SingleByteRegisters,
    lowerByte: Z80SingleByteRegisters
  ): number {
    return (this.#registers[higherByte] << 8) + this.#registers[lowerByte];
  }

  private distributeToRegisterPair(
    higherByte: Z80SingleByteRegisters,
    lowerByte: Z80SingleByteRegisters,
    val: number
  ) {
    this.#registers[lowerByte] = val & 0xff;
    this.#registers[higherByte] = (val >> 8) & 0xff;
  }

  private get zeroFlag() {
    return (this.#registers.f & 0x80) !== 0;
  }

  private set zeroFlag(bool: boolean) {
    if (bool) {
      this.#registers.f |= 0x80;
    } else {
      this.#registers.f &= 0xff ^ 0x80;
    }
  }

  private get substractionFlag() {
    return (this.#registers.f & 0x40) !== 0;
  }

  private set substractionFlag(bool: boolean) {
    if (bool) {
      this.#registers.f |= 0x40;
    } else {
      this.#registers.f &= 0xff ^ 0x40;
    }
  }

  private get halfCarryFlag() {
    return (this.#registers.f & 0x20) !== 0;
  }

  private set halfCarryFlag(bool: boolean) {
    if (bool) {
      this.#registers.f |= 0x20;
    } else {
      this.#registers.f &= 0xff ^ 0x20;
    }
  }

  private get carryFlag() {
    return (this.#registers.f & 0x10) !== 0;
  }

  private set carryFlag(bool: boolean) {
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

  // ***** General Ops starts *****
  // Try to impl ops with general inner impls.

  private LD_RR_d16(
    higherByteRegister: Z80SingleByteRegisters,
    lowerByteRegister: Z80SingleByteRegisters
  ) {
    const lowerByte = this.readFromPcAndIncPc();
    const higherByte = this.readFromPcAndIncPc();
    this.distributeToRegisterPair(
      higherByteRegister,
      lowerByteRegister,
      (higherByte << 8) + lowerByte
    );
  }

  private LD_RRa_R(
    addrHigherByteRegister: Z80SingleByteRegisters,
    addrLowerByteRegister: Z80SingleByteRegisters,
    valueRegister: Z80SingleByteRegisters
  ) {
    const addr = this.joinRegisterPair(
      addrHigherByteRegister,
      addrLowerByteRegister
    );
    this.#memory.writeByte(addr, this.#registers[valueRegister]);
  }

  private INC_RR(
    higherByteRegister: Z80SingleByteRegisters,
    lowerByteRegister: Z80SingleByteRegisters
  ) {
    const val = this.joinRegisterPair(higherByteRegister, lowerByteRegister);
    this.distributeToRegisterPair(
      higherByteRegister,
      lowerByteRegister,
      (val + 1) & 0xffff
    );
  }

  private INC_R(register: Z80SingleByteRegisters) {
    const val = this.#registers[register];
    const result = (val + 1) & 0xff;
    this.#registers[register] = result;
    this.zeroFlag = shouldSetZeroFlag(result);
    this.substractionFlag = false;
    this.halfCarryFlag = shouldSetHalfCarryFlag(
      val,
      1,
      Operation.Add,
      BitLength.OneByte
    );
  }

  private DEC_R(register: Z80SingleByteRegisters) {
    const val = this.#registers[register];
    const result = (val - 1) & 0xff;
    this.#registers[register] = result;
    this.zeroFlag = shouldSetZeroFlag(result);
    this.substractionFlag = true;
    this.halfCarryFlag = shouldSetHalfCarryFlag(
      val,
      1,
      Operation.Minus,
      BitLength.OneByte
    );
  }

  private LD_R_d8(register: Z80SingleByteRegisters) {
    this.#registers[register] = this.readFromPcAndIncPc();
  }

  private ADD_RR_RR(
    targetHigherByteRegister: Z80SingleByteRegisters,
    targetLowerByteRegister: Z80SingleByteRegisters,
    sourceHigherByteRegister: Z80SingleByteRegisters,
    sourceLowerByteRegister: Z80SingleByteRegisters
  ) {
    const source = this.joinRegisterPair(
      sourceHigherByteRegister,
      sourceLowerByteRegister
    );
    const target = this.joinRegisterPair(
      targetHigherByteRegister,
      targetLowerByteRegister
    );
    const result = (target + source) & 0xff;
    this.distributeToRegisterPair('h', 'l', result);
    this.substractionFlag = false;
    this.halfCarryFlag = shouldSetHalfCarryFlag(
      target,
      source,
      Operation.Add,
      BitLength.DoubleByte
    );
    this.carryFlag = shouldSetCarryFlag(
      target,
      source,
      Operation.Add,
      BitLength.DoubleByte
    );
  }

  private LD_R_RRa(
    targetRegister: Z80SingleByteRegisters,
    addrHigherByteRegister: Z80SingleByteRegisters,
    addrLowerByteRegister: Z80SingleByteRegisters
  ) {
    const addr = this.joinRegisterPair(
      addrHigherByteRegister,
      addrLowerByteRegister
    );
    this.#registers[targetRegister] = this.#memory.readByte(addr);
  }

  private DEC_RR(
    higherByteRegister: Z80SingleByteRegisters,
    lowerByteRegister: Z80SingleByteRegisters
  ) {
    const val = this.joinRegisterPair(higherByteRegister, lowerByteRegister);
    this.distributeToRegisterPair(
      higherByteRegister,
      lowerByteRegister,
      (val - 1) & 0xff
    );
  }

  // ***** [1st 8 ops] [0x00 - 0x07] starts *****

  private NOP() {}

  private LD_BC_d16() {
    this.LD_RR_d16('b', 'c');
  }

  private LD_BCa_A() {
    this.LD_RRa_R('b', 'c', 'a');
  }

  private INC_BC() {
    this.INC_RR('b', 'c');
  }

  private INC_B() {
    this.INC_R('b');
  }

  private DEC_B() {
    this.DEC_R('b');
  }

  private LD_B_d8() {
    this.LD_R_d8('b');
  }

  private RLCA() {
    const lastBit = (this.#registers.a & (0x1 << 7)) !== 0 ? 1 : 0;
    const leftOne = ((this.#registers.a & 0xff) << 1) & 0xff;
    const result = (leftOne & ~1) | lastBit;
    this.#registers.a = result;
    this.carryFlag = lastBit === 1;
  }

  // ***** [1st 8 ops] [0x00 - 0x07] ends *****

  // ***** [2nd 8 ops] [0x08 - 0x0f] starts  *****

  private LD_d16a_SP() {
    const addrLB = this.readFromPcAndIncPc();
    const addrHB = this.readFromPcAndIncPc();
    const addr = ((addrHB << 8) & 0xff) + (0xff & addrLB);
    this.#memory.writeDoubleByte(addr, this.#registers.sp);
  }

  private ADD_HL_BC() {
    this.ADD_RR_RR('h', 'l', 'b', 'c');
  }

  private LD_A_BCa() {
    this.LD_R_RRa('a', 'b', 'c');
  }

  private DEC_BC() {
    this.DEC_RR('b', 'c');
  }

  private INC_C() {
    this.INC_R('c');
  }

  private DEC_C() {
    this.DEC_R('c');
  }

  private LD_C_d8() {
    this.LD_R_d8('c');
  }

  private RRCA() {
    const a = this.#registers.a & 0xff;
    const firstBit = 1 & a;
    this.#registers.a = (0xff & (a >> 1) & ((1 << 7) - 1)) | (firstBit << 7);
    this.carryFlag = firstBit === 1;
  }

  // ***** [2nd 8 ops] [0x08 - 0x0f] ends  *****

  // ***** [3rd 8 ops] [0x10 - 0x17] ends  *****

  private Stop() {
    // todo: check usage
    this.pcInc();
  }

  private LD_DE_d16() {
    this.LD_RR_d16('d', 'e');
  }

  private LD_DEa_A() {
    this.LD_RRa_R('d', 'e', 'a');
  }

  private INC_DE() {
    this.INC_RR('d', 'e');
  }

  private INC_D() {
    this.INC_R('d');
  }

  private DEC_D() {
    this.DEC_R('d');
  }

  private LD_D_d8() {
    this.LD_R_d8('d');
  }

  private RLA() {
    const a = this.#registers.a;
    const lastBit = (a & (1 << 7)) >> 7;
    const movedLeft = (a << 1) & 0xff;
    const result = (movedLeft & ~1) | (this.carryFlag ? 1 : 0);
    this.carryFlag = lastBit === 0 ? false : true;
  }

  // ***** [3rd 8 ops] [0x10 - 0x17] ends  *****

  // ***** [4th 8 ops] [0x18 - 0x1f] starts  *****

  private JR_s8() {
    const notParsed8Bit = this.readFromPcAndIncPc();
    const parsed = parseAsSigned(notParsed8Bit, BitLength.OneByte);
    this.#registers.pc += parsed;
  }

  private ADD_HL_DE() {
    this.ADD_RR_RR('h', 'l', 'd', 'e');
  }

  private LD_A_DEa() {
    this.LD_R_RRa('a', 'd', 'e');
  }

  private DEC_DE() {
    this.DEC_RR('d', 'e');
  }

  private INC_E() {
    this.INC_R('e');
  }

  private DEC_E() {
    this.DEC_R('e');
  }

  private LD_E_d8() {
    this.LD_R_d8('e');
  }

  private RRA() {
    const carryFlag = this.carryFlag;
    const firstByte = this.#registers.a & 1;
    const movedRight = (this.#registers.a >> 1) & 0xff;
    const registerResult =
      (movedRight & ((1 << 7) - 1)) | ((carryFlag ? 1 : 0) << 7);
    this.carryFlag = firstByte === 1 ? true : false;
    this.#registers.a = registerResult;
  }

  // ***** [4th 8 ops] [0x18 - 0x1f] ends  *****
}

export abstract class MMU {
  abstract readByte(addr: number): number;
  abstract writeByte(addr: number, val: number): void;

  abstract readDoubleByte(addr: number): number;
  abstract writeDoubleByte(addr: number, val: number): void;
}

type Z80SingleByteRegisters = 'a' | 'b' | 'c' | 'd' | 'e' | 'h' | 'l' | 'f';
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

function parseAsSigned(val: number, bitLength: number) {
  const allOnes = (1 << bitLength) - 1;

  const lastBit = ((1 << (bitLength - 1)) & val) >> (bitLength - 1);
  if (lastBit === 1) {
    return -((~val + 1) & allOnes);
  } else if (lastBit === 0) {
    return val & ((1 << bitLength) - 1);
  } else {
    throw new Error('Bug when parsing!');
  }
}
