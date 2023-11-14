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

    // 5th
    this.JR_NZ_s8,
    this.LD_HL_d16,
    this.LD_HLa_A_and_INC_HL,
    this.INC_HL,
    this.INC_H,
    this.DEC_H,
    this.LD_H_d8,
    this.DAA,

    // 6th
    this.JR_Z_s8,
    this.ADD_HL_HL,
    this.LD_A_HLa_and_INC_HL,
    this.DEC_HL,
    this.INC_L,
    this.DEC_L,
    this.LD_L_d8,
    this.CPL,

    // 7th
    this.JR_NC_s8,
    this.LD_SP_d16,
    this.LD_HLa_A_and_DEC_HL,
    this.INC_SP,
    this.INC_HLa,
    this.DEC_HLa,
    this.LD_HLa_d8,
    this.SCF,

    // 8th
    this.JR_C_s8,
    this.ADD_HL_SP,
    this.LD_A_HLa_and_DEC_HL,
    this.DEC_SP,
    this.INC_A,
    this.DEC_A,
    this.LD_A_d8,
    this.CCF,
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

  private joinTwoByte(higherByte: number, lowerByte: number) {
    return ((higherByte & 0xff) << 8) + (lowerByte & 0xff);
  }

  private joinRegisterPair(
    higherByte: Z80SingleByteRegisters,
    lowerByte: Z80SingleByteRegisters
  ): number {
    return this.joinTwoByte(
      this.#registers[higherByte],
      this.#registers[lowerByte]
    );
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
    this.INC_doubleByteR('pc');
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
    this.#registers[higherByteRegister] = higherByte;
    this.#registers[lowerByteRegister] = lowerByte;
  }

  private LD_doubleByteR_d16(doubleBytreRegister: Z80DoubleByteRegisters) {
    const lowerByte = this.readFromPcAndIncPc();
    const higherByte = this.readFromPcAndIncPc();
    this.#registers[doubleBytreRegister] = this.joinTwoByte(
      higherByte,
      lowerByte
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
      addWithDoubleByte(val, 1)
    );
  }

  private INC_doubleByteR(doubleByteRegister: Z80DoubleByteRegisters) {
    this.#registers[doubleByteRegister] = addWithDoubleByte(
      this.#registers[doubleByteRegister],
      1
    );
  }

  private INC_R(register: Z80SingleByteRegisters) {
    const val = this.#registers[register];
    const result = addWithOneByte(val, 1);
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
    const result = minusWithOneByte(val, 1);
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
    const result = addWithDoubleByte(target, source);
    this.distributeToRegisterPair(
      targetHigherByteRegister,
      targetLowerByteRegister,
      result
    );
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

  private ADD_RR_doubleByteR(
    targetHigherByteRegister: Z80SingleByteRegisters,
    targetLowerByteRegister: Z80SingleByteRegisters,
    sourceDoubleByteRegister: Z80DoubleByteRegisters
  ) {
    const source = this.#registers[sourceDoubleByteRegister];
    const target = this.joinRegisterPair(
      targetHigherByteRegister,
      targetLowerByteRegister
    );
    const result = addWithDoubleByte(target, source);
    this.distributeToRegisterPair(
      targetHigherByteRegister,
      targetLowerByteRegister,
      result
    );
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
      minusWithDoubleByte(val, 1)
    );
  }

  private DEC_doublyByteR(doubleByteRegister: Z80DoubleByteRegisters) {
    const val = this.#registers[doubleByteRegister];
    this.#registers[doubleByteRegister] = minusWithDoubleByte(val, 1);
  }

  private INC_RRa(
    addrHigherByteRegister: Z80SingleByteRegisters,
    addrLowerByteRegister: Z80SingleByteRegisters
  ) {
    const addr = this.joinRegisterPair(
      addrHigherByteRegister,
      addrLowerByteRegister
    );
    const val = this.#memory.readByte(addr);
    const result = addWithOneByte(val, 1);
    this.#memory.writeByte(addr, result);
    this.zeroFlag = shouldSetZeroFlag(result);
    this.substractionFlag = false;
    this.halfCarryFlag = shouldSetHalfCarryFlag(
      val,
      1,
      Operation.Add,
      BitLength.OneByte
    );
  }

  private DEC_RRa(
    addrHigherByteRegister: Z80SingleByteRegisters,
    addrLowerByteRegister: Z80SingleByteRegisters
  ) {
    const addr = this.joinRegisterPair(
      addrHigherByteRegister,
      addrLowerByteRegister
    );
    const val = this.#memory.readByte(addr);
    const result = minusWithOneByte(val, 1);
    this.#memory.writeByte(addr, result);
    this.zeroFlag = shouldSetZeroFlag(result);
    this.substractionFlag = true;
    this.halfCarryFlag = shouldSetHalfCarryFlag(
      val,
      1,
      Operation.Minus,
      BitLength.OneByte
    );
  }

  private LD_RRa_d8(
    addrHigherByteRegister: Z80SingleByteRegisters,
    addrLowerByteRegister: Z80SingleByteRegisters
  ) {
    const addr = this.joinRegisterPair(
      addrHigherByteRegister,
      addrLowerByteRegister
    );
    const val = this.readFromPcAndIncPc();
    this.#memory.writeByte(addr, val);
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
    const addr = this.joinTwoByte(addrHB, addrLB);
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
    this.#registers.a = result;
    this.carryFlag = lastBit === 0 ? false : true;
  }

  // ***** [3rd 8 ops] [0x10 - 0x17] ends  *****

  // ***** [4th 8 ops] [0x18 - 0x1f] starts  *****

  private JR_s8() {
    const notParsed8Bit = this.readFromPcAndIncPc();
    const parsed = parseAsSigned(notParsed8Bit, BitLength.OneByte);
    this.#registers.pc = addWithDoubleByte(this.#registers.pc, parsed);
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

  // ***** [5th 8 ops] [0x20 - 0x27] starts  *****

  private JR_NZ_s8() {
    if (this.zeroFlag) {
      // no jump
      this.pcInc();
    } else {
      // jump
      this.JR_s8();
    }
  }

  private LD_HL_d16() {
    this.LD_RR_d16('h', 'l');
  }

  private LD_HLa_A_and_INC_HL() {
    this.LD_RRa_R('h', 'l', 'a');
    this.INC_RR('h', 'l');
  }

  private INC_HL() {
    this.INC_RR('h', 'l');
  }

  private INC_H() {
    this.INC_R('h');
  }

  private DEC_H() {
    this.DEC_R('h');
  }

  private LD_H_d8() {
    this.LD_R_d8('h');
  }

  private DAA() {
    let a = this.#registers.a;
    if (this.halfCarryFlag || (a & 0xf) > 0x9) a += 6;
    this.zeroFlag = false;
    if (this.halfCarryFlag || a > 0x99) {
      a += 0x60;
      this.carryFlag = true;
    }
    this.#registers.a = a;
  }

  // ***** [5th 8 ops] [0x20 - 0x27] ends  *****

  // ***** [6th 8 ops] [0x28 - 0x2f] starts  *****

  private JR_Z_s8() {
    if (this.zeroFlag) {
      // jump
      this.JR_s8();
    } else {
      // no jump
      this.pcInc();
    }
  }

  private ADD_HL_HL() {
    this.ADD_RR_RR('h', 'l', 'h', 'l');
  }

  private LD_A_HLa_and_INC_HL() {
    this.LD_R_RRa('a', 'h', 'l');
    this.INC_RR('h', 'l');
  }

  private DEC_HL() {
    this.DEC_RR('h', 'l');
  }

  private INC_L() {
    this.INC_R('l');
  }

  private DEC_L() {
    this.DEC_R('l');
  }

  private LD_L_d8() {
    this.LD_R_d8('l');
  }

  private CPL() {
    this.#registers.a = ~this.#registers.a & 0xff;
    this.substractionFlag = true;
    this.halfCarryFlag = true;
  }

  // ***** [6th 8 ops] [0x28 - 0x2f] ends  *****

  // ***** [7th 8 ops] [0x30 - 0x37] starts  *****

  private JR_NC_s8() {
    if (this.carryFlag) {
      // no jump
      this.pcInc();
    } else {
      this.JR_s8();
    }
  }

  private LD_SP_d16() {
    this.LD_doubleByteR_d16('sp');
  }

  private LD_HLa_A_and_DEC_HL() {
    this.LD_RRa_R('h', 'l', 'a');
    this.DEC_HL();
  }

  private INC_SP() {
    this.INC_doubleByteR('sp');
  }

  private INC_HLa() {
    this.INC_RRa('h', 'l');
  }

  private DEC_HLa() {
    this.DEC_RR('h', 'l');
  }

  private LD_HLa_d8() {
    this.LD_RRa_d8('h', 'l');
  }

  private SCF() {
    this.substractionFlag = false;
    this.halfCarryFlag = false;
    this.carryFlag = true;
  }

  // ***** [7th 8 ops] [0x30 - 0x37] ends  *****

  // ***** [8th 8 ops] [0x38 - 0x3f] starts  *****

  private JR_C_s8() {
    if (this.carryFlag) {
      // jump
      this.JR_s8();
    } else {
      // no jump
      this.pcInc();
    }
  }

  private ADD_HL_SP() {
    this.ADD_RR_doubleByteR('h', 'l', 'sp');
  }

  private LD_A_HLa_and_DEC_HL() {
    this.LD_R_RRa('a', 'h', 'l');
    this.DEC_HL();
  }

  private DEC_SP() {
    this.DEC_doublyByteR('sp');
  }

  private INC_A() {
    this.INC_R('a');
  }

  private DEC_A() {
    this.DEC_R('a');
  }

  private LD_A_d8() {
    this.LD_R_d8('a');
  }

  private CCF() {
    this.halfCarryFlag = !this.halfCarryFlag;
    this.substractionFlag = false;
    this.halfCarryFlag = false;
  }

  // ***** [8th 8 ops] [0x38 - 0x3f] ends  *****
}

export abstract class MMU {
  abstract readByte(addr: number): number;
  abstract writeByte(addr: number, val: number): void;

  abstract readDoubleByte(addr: number): number;
  abstract writeDoubleByte(addr: number, val: number): void;
}

type Z80SingleByteRegisters = 'a' | 'b' | 'c' | 'd' | 'e' | 'h' | 'l' | 'f';
type Z80DoubleByteRegisters = 'sp' | 'pc';
type Z80Registers = Z80SingleByteRegisters | Z80DoubleByteRegisters;

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

function addWithOneByte(left: number, right: number) {
  return performOperationOnOperandsWithBitLength(
    left,
    right,
    Operation.Add,
    BitLength.OneByte
  );
}

function minusWithOneByte(left: number, right: number) {
  return performOperationOnOperandsWithBitLength(
    left,
    right,
    Operation.Minus,
    BitLength.OneByte
  );
}

function addWithDoubleByte(left: number, right: number) {
  return performOperationOnOperandsWithBitLength(
    left,
    right,
    Operation.Add,
    BitLength.DoubleByte
  );
}

function minusWithDoubleByte(left: number, right: number) {
  return performOperationOnOperandsWithBitLength(
    left,
    right,
    Operation.Minus,
    BitLength.DoubleByte
  );
}

function performOperationOnOperandsWithBitLength(
  left: number,
  right: number,
  operation: Operation,
  bitLength: number
) {
  let unfixedResult: number;
  switch (operation) {
    case Operation.Add:
      unfixedResult = left + right;
      break;
    case Operation.Minus:
      unfixedResult = left - right;
      break;
    default:
      throw new Error('perform operation: not implemented!');
  }

  const allOnes = (1 << bitLength) - 1;
  return unfixedResult & allOnes;
}
