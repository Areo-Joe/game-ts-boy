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

    // 9th
    this.LD_B_B,
    this.LD_B_C,
    this.LD_B_D,
    this.LD_B_E,
    this.LD_B_H,
    this.LD_B_L,
    this.LD_B_HLa,
    this.LD_B_A,

    // 10th
    this.LD_C_B,
    this.LD_C_C,
    this.LD_C_D,
    this.LD_C_E,
    this.LD_C_H,
    this.LD_C_L,
    this.LD_C_HLa,
    this.LD_C_A,

    // 11th
    this.LD_D_B,
    this.LD_D_C,
    this.LD_D_D,
    this.LD_D_E,
    this.LD_D_H,
    this.LD_D_L,
    this.LD_D_HLa,
    this.LD_D_A,

    // 12th
    this.LD_E_B,
    this.LD_E_C,
    this.LD_E_D,
    this.LD_E_E,
    this.LD_E_H,
    this.LD_E_L,
    this.LD_E_HLa,
    this.LD_E_A,

    // 13th
    this.LD_H_B,
    this.LD_H_C,
    this.LD_H_D,
    this.LD_H_E,
    this.LD_H_H,
    this.LD_H_L,
    this.LD_H_HLa,
    this.LD_H_A,

    // 14th
    this.LD_L_B,
    this.LD_L_C,
    this.LD_L_D,
    this.LD_L_E,
    this.LD_L_H,
    this.LD_L_L,
    this.LD_L_HLa,
    this.LD_L_A,

    // 15th
    this.LD_HLa_B,
    this.LD_HLa_C,
    this.LD_HLa_D,
    this.LD_HLa_E,
    this.LD_HLa_H,
    this.LD_HLa_L,
    this.HALT,
    this.LD_HLa_A,

    // 16th
    this.LD_A_B,
    this.LD_A_C,
    this.LD_A_D,
    this.LD_A_E,
    this.LD_A_H,
    this.LD_A_L,
    this.LD_A_HLa,
    this.LD_A_A,

    // 17th
    this.ADD_A_B,
    this.ADD_A_C,
    this.ADD_A_D,
    this.ADD_A_E,
    this.ADD_A_H,
    this.ADD_A_L,
    this.ADD_A_HLa,
    this.ADD_A_A,

    // 18th
    this.ADC_A_B,
    this.ADC_A_C,
    this.ADC_A_D,
    this.ADC_A_E,
    this.ADC_A_H,
    this.ADC_A_L,
    this.ADC_A_HLa,
    this.ADC_A_A,

    // 19th
    this.SUB_A_B,
    this.SUB_A_C,
    this.SUB_A_D,
    this.SUB_A_E,
    this.SUB_A_H,
    this.SUB_A_L,
    this.SUB_A_HLa,
    this.SUB_A_A,

    // 20th
    this.SBC_A_B,
    this.SBC_A_C,
    this.SBC_A_D,
    this.SBC_A_E,
    this.SBC_A_H,
    this.SBC_A_L,
    this.SBC_A_HLa,
    this.SBC_A_A,

    // 21st
    this.AND_A_B,
    this.AND_A_C,
    this.AND_A_D,
    this.AND_A_E,
    this.AND_A_H,
    this.AND_A_L,
    this.AND_A_HLa,
    this.AND_A_A,

    // 22nd
    this.XOR_A_B,
    this.XOR_A_C,
    this.XOR_A_D,
    this.XOR_A_E,
    this.XOR_A_H,
    this.XOR_A_L,
    this.XOR_A_HLa,
    this.XOR_A_A,

    // 23rd
    this.OR_A_B,
    this.OR_A_C,
    this.OR_A_D,
    this.OR_A_E,
    this.OR_A_H,
    this.OR_A_L,
    this.OR_A_HLa,
    this.OR_A_A,

    // 24th
    this.CP_A_B,
    this.CP_A_C,
    this.CP_A_D,
    this.CP_A_E,
    this.CP_A_H,
    this.CP_A_L,
    this.CP_A_HLa,
    this.CP_A_A,

    // 25th
    this.RET_NZ,
    this.POP_BC,
    this.JP_NZ_d16a,
    this.JP_d16a,
    this.CALL_NZ_d16a,
    this.PUSH_BC,
    this.ADD_A_d8,
    this.RST_0,

    // 26th
    this.RET_Z,
    this.RET,
    this.JP_Z_d16a,
    this.CALL_OP_WITH_CB_PREFIX,
    this.CALL_Z_d16_a,
    this.CALL_d16a,
    this.ADC_A_d8,
    this.RST_1,

    // 27th
    this.RET_NC,
    this.POP_DE,
    this.JP_NC_d16a,
    this.EMPTY_OPCODE,
    this.CALL_NC_d16a,
    this.PUSH_DE,
    this.SUB_A_d8,
    this.RST_2,

    // 28th
    this.RET_C,
    this.RETI,
    this.JP_C_d16a,
    this.EMPTY_OPCODE,
    this.CALL_C_d16a,
    this.EMPTY_OPCODE,
    this.SBC_A_d8,
    this.RST_3,

    // 29th
    this.LD_d8a_A,
    this.POP_HL,
    this.LD_Ca_A,
    this.EMPTY_OPCODE,
    this.EMPTY_OPCODE,
    this.PUSH_HL,
    this.AND_d8,
    this.RST_4,

    // 30th
    this.ADD_SP_s8,
    this.JP_HL,
    this.LD_d16a_A,
    this.EMPTY_OPCODE,
    this.EMPTY_OPCODE,
    this.EMPTY_OPCODE,
    this.XOR_d8,
    this.RST_5,
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

  private readFromSp() {
    return this.#memory.readByte(this.#registers.sp);
  }

  private readFromSpAndIncSp() {
    const ret = this.readFromSp();
    this.INC_SP();
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
      Operation.Add,
      BitLength.OneByte,
      val,
      1
    );
  }

  private DEC_R(register: Z80SingleByteRegisters) {
    const val = this.#registers[register];
    const result = minusWithOneByte(val, 1);
    this.#registers[register] = result;
    this.zeroFlag = shouldSetZeroFlag(result);
    this.substractionFlag = true;
    this.halfCarryFlag = shouldSetHalfCarryFlag(
      Operation.Minus,
      BitLength.OneByte,
      val,
      1
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
      Operation.Add,
      BitLength.DoubleByte,
      target,
      source
    );
    this.carryFlag = shouldSetCarryFlag(
      Operation.Add,
      BitLength.DoubleByte,
      target,
      source
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
      Operation.Add,
      BitLength.DoubleByte,
      target,
      source
    );
    this.carryFlag = shouldSetCarryFlag(
      Operation.Add,
      BitLength.DoubleByte,
      target,
      source
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
      Operation.Add,
      BitLength.OneByte,
      val,
      1
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
      Operation.Minus,
      BitLength.OneByte,
      val,
      1
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

  private LD_R_R(
    targetRegister: Z80SingleByteRegisters,
    sourceRegister: Z80SingleByteRegisters
  ) {
    this.#registers[targetRegister] = this.#registers[sourceRegister];
  }

  private ADD_R_R(
    targetRegister: Z80SingleByteRegisters,
    sourceRegister: Z80SingleByteRegisters
  ) {
    const target = this.#registers[targetRegister];
    const source = this.#registers[sourceRegister];

    const result = addWithOneByte(target, source);
    this.#registers[targetRegister] = result;

    this.zeroFlag = shouldSetZeroFlag(result);
    this.substractionFlag = false;
    this.halfCarryFlag = shouldSetHalfCarryFlag(
      Operation.Add,
      BitLength.OneByte,
      target,
      source
    );
    this.carryFlag = shouldSetCarryFlag(
      Operation.Add,
      BitLength.OneByte,
      target,
      source
    );
  }

  private ADD_R_RRa(
    targetRegister: Z80SingleByteRegisters,
    addrHigherByteRegister: Z80SingleByteRegisters,
    addrLowerByteRegister: Z80SingleByteRegisters
  ) {
    const addr = this.joinRegisterPair(
      addrHigherByteRegister,
      addrLowerByteRegister
    );

    const target = this.#registers[targetRegister];
    const source = this.#memory.readByte(addr);
    const result = addWithOneByte(target, source);

    this.zeroFlag = shouldSetZeroFlag(result);
    this.substractionFlag = false;
    this.halfCarryFlag = shouldSetHalfCarryFlag(
      Operation.Add,
      BitLength.OneByte,
      target,
      source
    );
    this.carryFlag = shouldSetCarryFlag(
      Operation.Add,
      BitLength.OneByte,
      target,
      source
    );
  }

  private ADC_R_R(
    targetRegister: Z80SingleByteRegisters,
    sourceRegister: Z80SingleByteRegisters
  ) {
    const target = this.#registers[targetRegister];
    const source = this.#registers[sourceRegister];

    const result = addWithOneByte(target, source, this.carryFlag ? 1 : 0);
    this.#registers[targetRegister] = result;

    this.zeroFlag = shouldSetZeroFlag(result);
    this.substractionFlag = false;
    this.halfCarryFlag = shouldSetHalfCarryFlag(
      Operation.Add,
      BitLength.OneByte,
      target,
      source,
      this.carryFlag ? 1 : 0
    );
    this.carryFlag = shouldSetCarryFlag(
      Operation.Add,
      BitLength.OneByte,
      target,
      source,
      this.carryFlag ? 1 : 0
    );
  }

  private ADC_R_RRa(
    targetRegister: Z80SingleByteRegisters,
    addrHigherByteRegister: Z80SingleByteRegisters,
    addrLowerByteRegister: Z80SingleByteRegisters
  ) {
    const addr = this.joinRegisterPair(
      addrHigherByteRegister,
      addrLowerByteRegister
    );

    const target = this.#registers[targetRegister];
    const source = this.#memory.readByte(addr);

    const result = addWithOneByte(target, source, this.carryFlag ? 1 : 0);
    this.#registers[targetRegister] = result;

    this.zeroFlag = shouldSetZeroFlag(result);
    this.substractionFlag = false;
    this.halfCarryFlag = shouldSetHalfCarryFlag(
      Operation.Add,
      BitLength.OneByte,
      target,
      source,
      this.carryFlag ? 1 : 0
    );
    this.carryFlag = shouldSetCarryFlag(
      Operation.Add,
      BitLength.OneByte,
      target,
      source,
      this.carryFlag ? 1 : 0
    );
  }

  private SUB_R_R(
    targetRegister: Z80SingleByteRegisters,
    sourceRegister: Z80SingleByteRegisters
  ) {
    const target = this.#registers[targetRegister];
    const source = this.#registers[sourceRegister];

    const result = minusWithOneByte(target, source);
    this.#registers[targetRegister] = result;

    this.zeroFlag = shouldSetZeroFlag(result);
    this.substractionFlag = true;
    this.halfCarryFlag = shouldSetHalfCarryFlag(
      Operation.Minus,
      BitLength.OneByte,
      target,
      source
    );
    this.carryFlag = shouldSetCarryFlag(
      Operation.Minus,
      BitLength.OneByte,
      target,
      source
    );
  }

  private SUB_R_RRa(
    targetRegister: Z80SingleByteRegisters,
    addrHigherByteRegister: Z80SingleByteRegisters,
    addrLowerByteRegister: Z80SingleByteRegisters
  ) {
    const addr = this.joinRegisterPair(
      addrHigherByteRegister,
      addrLowerByteRegister
    );

    const target = this.#registers[targetRegister];
    const source = this.#memory.readByte(addr);
    const result = minusWithOneByte(target, source);

    this.zeroFlag = shouldSetZeroFlag(result);
    this.substractionFlag = true;
    this.halfCarryFlag = shouldSetHalfCarryFlag(
      Operation.Minus,
      BitLength.OneByte,
      target,
      source
    );
    this.carryFlag = shouldSetCarryFlag(
      Operation.Minus,
      BitLength.OneByte,
      target,
      source
    );
  }

  private SBC_R_R(
    targetRegister: Z80SingleByteRegisters,
    sourceRegister: Z80SingleByteRegisters
  ) {
    const target = this.#registers[targetRegister];
    const source = this.#registers[sourceRegister];

    const result = minusWithOneByte(target, source, this.carryFlag ? 1 : 0);
    this.#registers[targetRegister] = result;

    this.zeroFlag = shouldSetZeroFlag(result);
    this.substractionFlag = false;
    this.halfCarryFlag = shouldSetHalfCarryFlag(
      Operation.Minus,
      BitLength.OneByte,
      target,
      source,
      this.carryFlag ? 1 : 0
    );
    this.carryFlag = shouldSetCarryFlag(
      Operation.Minus,
      BitLength.OneByte,
      target,
      source,
      this.carryFlag ? 1 : 0
    );
  }

  private SBC_R_RRa(
    targetRegister: Z80SingleByteRegisters,
    addrHigherByteRegister: Z80SingleByteRegisters,
    addrLowerByteRegister: Z80SingleByteRegisters
  ) {
    const addr = this.joinRegisterPair(
      addrHigherByteRegister,
      addrLowerByteRegister
    );

    const target = this.#registers[targetRegister];
    const source = this.#memory.readByte(addr);

    const result = minusWithOneByte(target, source, this.carryFlag ? 1 : 0);
    this.#registers[targetRegister] = result;

    this.zeroFlag = shouldSetZeroFlag(result);
    this.substractionFlag = false;
    this.halfCarryFlag = shouldSetHalfCarryFlag(
      Operation.Minus,
      BitLength.OneByte,
      target,
      source,
      this.carryFlag ? 1 : 0
    );
    this.carryFlag = shouldSetCarryFlag(
      Operation.Minus,
      BitLength.OneByte,
      target,
      source,
      this.carryFlag ? 1 : 0
    );
  }

  private AND_R_R(
    targetRegister: Z80SingleByteRegisters,
    sourceRegister: Z80SingleByteRegisters
  ) {
    const target = this.#registers[targetRegister];
    const source = this.#registers[sourceRegister];

    const result = andWithOneByte(target, source);
    this.#registers[targetRegister] = result;

    this.zeroFlag = shouldSetZeroFlag(result);
    this.substractionFlag = false;
    this.halfCarryFlag = true;
    this.carryFlag = false;
  }

  private AND_R_RRa(
    targetRegister: Z80SingleByteRegisters,
    addrHigherByteRegister: Z80SingleByteRegisters,
    addrLowerByteRegister: Z80SingleByteRegisters
  ) {
    const addr = this.joinRegisterPair(
      addrHigherByteRegister,
      addrLowerByteRegister
    );

    const target = this.#registers[targetRegister];
    const source = this.#memory.readByte(addr);

    const result = andWithOneByte(target, source);
    this.#registers[targetRegister] = result;

    this.zeroFlag = shouldSetZeroFlag(result);
    this.substractionFlag = false;
    this.halfCarryFlag = true;
    this.carryFlag = false;
  }

  private XOR_R_R(
    targetRegister: Z80SingleByteRegisters,
    sourceRegister: Z80SingleByteRegisters
  ) {
    const target = this.#registers[targetRegister];
    const source = this.#registers[sourceRegister];

    const result = xorWithOneByte(target, source);
    this.#registers[targetRegister] = result;

    this.zeroFlag = shouldSetZeroFlag(result);
    this.substractionFlag = false;
    this.halfCarryFlag = false;
    this.carryFlag = false;
  }

  private XOR_R_RRa(
    targetRegister: Z80SingleByteRegisters,
    addrHigherByteRegister: Z80SingleByteRegisters,
    addrLowerByteRegister: Z80SingleByteRegisters
  ) {
    const addr = this.joinRegisterPair(
      addrHigherByteRegister,
      addrLowerByteRegister
    );

    const target = this.#registers[targetRegister];
    const source = this.#memory.readByte(addr);

    const result = xorWithOneByte(target, source);
    this.#registers[targetRegister] = result;

    this.zeroFlag = shouldSetZeroFlag(result);
    this.substractionFlag = false;
    this.halfCarryFlag = false;
    this.carryFlag = false;
  }

  private OR_R_R(
    targetRegister: Z80SingleByteRegisters,
    sourceRegister: Z80SingleByteRegisters
  ) {
    const target = this.#registers[targetRegister];
    const source = this.#registers[sourceRegister];

    const result = orWithOneByte(target, source);
    this.#registers[targetRegister] = result;

    this.zeroFlag = shouldSetZeroFlag(result);
    this.substractionFlag = false;
    this.halfCarryFlag = false;
    this.carryFlag = false;
  }

  private OR_R_RRa(
    targetRegister: Z80SingleByteRegisters,
    addrHigherByteRegister: Z80SingleByteRegisters,
    addrLowerByteRegister: Z80SingleByteRegisters
  ) {
    const addr = this.joinRegisterPair(
      addrHigherByteRegister,
      addrLowerByteRegister
    );

    const target = this.#registers[targetRegister];
    const source = this.#memory.readByte(addr);

    const result = orWithOneByte(target, source);
    this.#registers[targetRegister] = result;

    this.zeroFlag = shouldSetZeroFlag(result);
    this.substractionFlag = false;
    this.halfCarryFlag = false;
    this.carryFlag = false;
  }

  private CP_R_R(
    targetRegister: Z80SingleByteRegisters,
    sourceRegister: Z80SingleByteRegisters
  ) {
    const target = this.#registers[targetRegister];
    const source = this.#registers[sourceRegister];

    const minusResult = minusWithOneByte(target, source); // we don't set the result here

    this.zeroFlag = shouldSetZeroFlag(minusResult);
    this.substractionFlag = true;
    this.halfCarryFlag = shouldSetHalfCarryFlag(
      Operation.Minus,
      BitLength.OneByte,
      target,
      source
    );
    this.carryFlag = shouldSetCarryFlag(
      Operation.Minus,
      BitLength.OneByte,
      target,
      source
    );
  }

  private CP_R_RRa(
    targetRegister: Z80SingleByteRegisters,
    addrHigherByteRegister: Z80SingleByteRegisters,
    addrLowerByteRegister: Z80SingleByteRegisters
  ) {
    const addr = this.joinRegisterPair(
      addrHigherByteRegister,
      addrLowerByteRegister
    );

    const target = this.#registers[targetRegister];
    const source = this.#memory.readByte(addr);

    const minusResult = minusWithOneByte(target, source); // we don't set the result here

    this.zeroFlag = shouldSetZeroFlag(minusResult);
    this.substractionFlag = true;
    this.halfCarryFlag = shouldSetHalfCarryFlag(
      Operation.Minus,
      BitLength.OneByte,
      target,
      source
    );
    this.carryFlag = shouldSetCarryFlag(
      Operation.Minus,
      BitLength.OneByte,
      target,
      source
    );
  }

  private POP_RR(
    higherByteRegister: Z80SingleByteRegisters,
    lowerByteRegister: Z80SingleByteRegisters
  ) {
    this.#registers[lowerByteRegister] = this.readFromSpAndIncSp();
    this.#registers[higherByteRegister] = this.readFromSpAndIncSp();
  }

  private PUSH_RR(
    higherByteRegister: Z80SingleByteRegisters,
    lowerByteRegister: Z80SingleByteRegisters
  ) {
    this.DEC_doublyByteR('sp');
    this.#memory.writeByte(
      this.#registers.sp,
      this.#registers[higherByteRegister]
    );
    this.DEC_doublyByteR('sp');
    this.#memory.writeByte(
      this.#registers.sp,
      this.#registers[lowerByteRegister]
    );
  }

  private PUSH_doubleByteR(doubleByteRegister: Z80DoubleByteRegisters) {
    this.DEC_doublyByteR('sp');
    this.#memory.writeByte(
      this.#registers.sp,
      higherByteOfDoubleByte(this.#registers[doubleByteRegister])
    );
    this.DEC_doublyByteR('sp');
    this.#memory.writeByte(
      this.#registers.sp,
      lowerByteOfDoubleByte(this.#registers[doubleByteRegister])
    );
  }

  private ADD_R_d8(targetRegister: Z80SingleByteRegisters) {
    const registerVal = this.#registers[targetRegister];
    const val = this.readFromPcAndIncPc();

    const result = addWithOneByte(registerVal, val);

    this.zeroFlag = shouldSetZeroFlag(result);
    this.substractionFlag = false;
    this.halfCarryFlag = shouldSetHalfCarryFlag(
      Operation.Add,
      BitLength.OneByte,
      registerVal,
      val
    );
    this.carryFlag = shouldSetCarryFlag(
      Operation.Add,
      BitLength.OneByte,
      registerVal,
      val
    );
  }

  private ADC_R_d8(targetRegister: Z80SingleByteRegisters) {
    const registerVal = this.#registers[targetRegister];
    const val = this.readFromPcAndIncPc();

    const result = addWithOneByte(registerVal, val, this.carryFlag ? 1 : 0);

    this.zeroFlag = shouldSetZeroFlag(result);
    this.substractionFlag = false;
    this.halfCarryFlag = shouldSetHalfCarryFlag(
      Operation.Add,
      BitLength.OneByte,
      registerVal,
      val,
      this.carryFlag ? 1 : 0
    );
    this.carryFlag = shouldSetCarryFlag(
      Operation.Add,
      BitLength.OneByte,
      registerVal,
      val,
      this.carryFlag ? 1 : 0
    );
  }

  private SUB_R_d8(targetRegister: Z80SingleByteRegisters) {
    const registerVal = this.#registers[targetRegister];
    const val = this.readFromPcAndIncPc();

    const result = minusWithOneByte(registerVal, val);

    this.zeroFlag = shouldSetZeroFlag(result);
    this.substractionFlag = true;
    this.halfCarryFlag = shouldSetHalfCarryFlag(
      Operation.Minus,
      BitLength.OneByte,
      registerVal,
      val
    );
    this.carryFlag = shouldSetCarryFlag(
      Operation.Minus,
      BitLength.OneByte,
      registerVal,
      val
    );
  }

  private SBC_R_d8(targetRegister: Z80SingleByteRegisters) {
    const registerVal = this.#registers[targetRegister];
    const val = this.readFromPcAndIncPc();

    const result = minusWithOneByte(registerVal, val, this.carryFlag ? 1 : 0);

    this.zeroFlag = shouldSetZeroFlag(result);
    this.substractionFlag = true;
    this.halfCarryFlag = shouldSetHalfCarryFlag(
      Operation.Minus,
      BitLength.OneByte,
      registerVal,
      val,
      this.carryFlag ? 1 : 0
    );
    this.carryFlag = shouldSetCarryFlag(
      Operation.Minus,
      BitLength.OneByte,
      registerVal,
      val,
      this.carryFlag ? 1 : 0
    );
  }

  private RST_n(n: number) {
    this.PUSH_doubleByteR('pc');
    this.#registers.pc = 0x0080 * n;
  }

  private EMPTY_OPCODE() {
    throw new Error('This op should not be called!');
  }

  private signal_io_device() {
    throw new Error('Signaling device is currently unimplemented!');
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

  // ***** [9th 8 ops] [0x40 - 0x47] starts  *****

  private LD_B_B() {
    this.LD_R_R('b', 'b');
  }

  private LD_B_C() {
    this.LD_R_R('b', 'c');
  }

  private LD_B_D() {
    this.LD_R_R('b', 'd');
  }

  private LD_B_E() {
    this.LD_R_R('b', 'e');
  }

  private LD_B_H() {
    this.LD_R_R('b', 'h');
  }

  private LD_B_L() {
    this.LD_R_R('b', 'l');
  }

  private LD_B_HLa() {
    this.LD_R_RRa('b', 'h', 'l');
  }

  private LD_B_A() {
    this.LD_R_R('b', 'a');
  }

  // ***** [9th 8 ops] [0x40 - 0x47] ends  *****

  // ***** [10th 8 ops] [0x48 - 0x4f] starts  *****

  private LD_C_B() {
    this.LD_R_R('c', 'b');
  }

  private LD_C_C() {
    this.LD_R_R('c', 'c');
  }

  private LD_C_D() {
    this.LD_R_R('c', 'd');
  }

  private LD_C_E() {
    this.LD_R_R('c', 'e');
  }

  private LD_C_H() {
    this.LD_R_R('c', 'h');
  }

  private LD_C_L() {
    this.LD_R_R('c', 'l');
  }

  private LD_C_HLa() {
    this.LD_R_RRa('c', 'h', 'l');
  }

  private LD_C_A() {
    this.LD_R_R('c', 'a');
  }

  // ***** [10th 8 ops] [0x48 - 0x4f] ends  *****

  // ***** [11th 8 ops] [0x50 - 0x57] starts  *****

  private LD_D_B() {
    this.LD_R_R('d', 'b');
  }

  private LD_D_C() {
    this.LD_R_R('d', 'c');
  }

  private LD_D_D() {
    this.LD_R_R('d', 'd');
  }

  private LD_D_E() {
    this.LD_R_R('d', 'e');
  }

  private LD_D_H() {
    this.LD_R_R('d', 'h');
  }

  private LD_D_L() {
    this.LD_R_R('d', 'l');
  }

  private LD_D_HLa() {
    this.LD_R_RRa('d', 'h', 'l');
  }

  private LD_D_A() {
    this.LD_R_R('d', 'a');
  }

  // ***** [11th 8 ops] [0x50 - 0x57] ends  *****

  // ***** [12th 8 ops] [0x58 - 0x5f] starts  *****

  private LD_E_B() {
    this.LD_R_R('e', 'b');
  }

  private LD_E_C() {
    this.LD_R_R('e', 'c');
  }

  private LD_E_D() {
    this.LD_R_R('e', 'd');
  }

  private LD_E_E() {
    this.LD_R_R('e', 'e');
  }

  private LD_E_H() {
    this.LD_R_R('e', 'h');
  }

  private LD_E_L() {
    this.LD_R_R('e', 'l');
  }

  private LD_E_HLa() {
    this.LD_R_RRa('e', 'h', 'l');
  }

  private LD_E_A() {
    this.LD_R_R('e', 'a');
  }

  // ***** [12th 8 ops] [0x58 - 0x5f] ends  *****

  // ***** [13th 8 ops] [0x60 - 0x67] starts  *****

  private LD_H_B() {
    this.LD_R_R('h', 'b');
  }

  private LD_H_C() {
    this.LD_R_R('h', 'c');
  }

  private LD_H_D() {
    this.LD_R_R('h', 'd');
  }

  private LD_H_E() {
    this.LD_R_R('h', 'e');
  }

  private LD_H_H() {
    this.LD_R_R('h', 'h');
  }

  private LD_H_L() {
    this.LD_R_R('h', 'l');
  }

  private LD_H_HLa() {
    this.LD_R_RRa('h', 'h', 'l');
  }

  private LD_H_A() {
    this.LD_R_R('h', 'a');
  }

  // ***** [13th 8 ops] [0x69 - 0x67] ends  *****

  // ***** [14th 8 ops] [0x68 - 0x6f] starts  *****

  private LD_L_B() {
    this.LD_R_R('l', 'b');
  }

  private LD_L_C() {
    this.LD_R_R('l', 'c');
  }

  private LD_L_D() {
    this.LD_R_R('l', 'd');
  }

  private LD_L_E() {
    this.LD_R_R('l', 'e');
  }

  private LD_L_H() {
    this.LD_R_R('l', 'h');
  }

  private LD_L_L() {
    this.LD_R_R('l', 'l');
  }

  private LD_L_HLa() {
    this.LD_R_RRa('l', 'h', 'l');
  }

  private LD_L_A() {
    this.LD_R_R('l', 'a');
  }

  // ***** [14th 8 ops] [0x68 - 0x6f] ends  *****

  // ***** [15th 8 ops] [0x70 - 0x77] starts  *****

  private LD_HLa_B() {
    this.LD_RRa_R('h', 'l', 'b');
  }

  private LD_HLa_C() {
    this.LD_RRa_R('h', 'l', 'c');
  }

  private LD_HLa_D() {
    this.LD_RRa_R('h', 'l', 'd');
  }

  private LD_HLa_E() {
    this.LD_RRa_R('h', 'l', 'e');
  }

  private LD_HLa_H() {
    this.LD_RRa_R('h', 'l', 'h');
  }

  private LD_HLa_L() {
    this.LD_RRa_R('h', 'l', 'l');
  }

  private HALT() {
    throw new Error('Unimplemented! Need to figure out its meaning!');
  }

  private LD_HLa_A() {
    this.LD_RRa_R('h', 'l', 'a');
  }

  // ***** [15th 8 ops] [0x70 - 0x77] ends  *****

  // ***** [16th 8 ops] [0x78 - 0x7f] starts  *****

  private LD_A_B() {
    this.LD_R_R('a', 'b');
  }

  private LD_A_C() {
    this.LD_R_R('a', 'c');
  }

  private LD_A_D() {
    this.LD_R_R('a', 'd');
  }

  private LD_A_E() {
    this.LD_R_R('a', 'e');
  }

  private LD_A_H() {
    this.LD_R_R('a', 'h');
  }

  private LD_A_L() {
    this.LD_R_R('a', 'l');
  }

  private LD_A_HLa() {
    this.LD_R_RRa('a', 'h', 'l');
  }

  private LD_A_A() {
    this.LD_R_R('a', 'a');
  }

  // ***** [16th 8 ops] [0x78 - 0x7f] ends  *****

  // ***** [17th 8 ops] [0x80 - 0x87] starts  *****

  private ADD_A_B() {
    this.ADD_R_R('a', 'b');
  }

  private ADD_A_C() {
    this.ADD_R_R('a', 'c');
  }

  private ADD_A_D() {
    this.ADD_R_R('a', 'd');
  }

  private ADD_A_E() {
    this.ADD_R_R('a', 'e');
  }

  private ADD_A_H() {
    this.ADD_R_R('a', 'h');
  }

  private ADD_A_L() {
    this.ADD_R_R('a', 'l');
  }

  private ADD_A_HLa() {
    this.ADD_R_RRa('a', 'h', 'l');
  }

  private ADD_A_A() {
    this.ADD_R_R('a', 'a');
  }

  // ***** [17th 8 ops] [0x80 - 0x87] ends  *****

  // ***** [18th 8 ops] [0x88 - 0x8f] starts  *****

  private ADC_A_B() {
    this.ADC_R_R('a', 'b');
  }

  private ADC_A_C() {
    this.ADC_R_R('a', 'c');
  }

  private ADC_A_D() {
    this.ADC_R_R('a', 'd');
  }

  private ADC_A_E() {
    this.ADC_R_R('a', 'e');
  }

  private ADC_A_H() {
    this.ADC_R_R('a', 'h');
  }

  private ADC_A_L() {
    this.ADC_R_R('a', 'l');
  }

  private ADC_A_HLa() {
    this.ADC_R_RRa('a', 'h', 'l');
  }

  private ADC_A_A() {
    this.ADC_R_R('a', 'a');
  }

  // ***** [18th 8 ops] [0x88 - 0x8f] ends  *****

  // ***** [19th 8 ops] [0x90 - 0x97] starts  *****

  private SUB_A_B() {
    this.SUB_R_R('a', 'b');
  }

  private SUB_A_C() {
    this.SUB_R_R('a', 'c');
  }

  private SUB_A_D() {
    this.SUB_R_R('a', 'd');
  }

  private SUB_A_E() {
    this.SUB_R_R('a', 'e');
  }

  private SUB_A_H() {
    this.SUB_R_R('a', 'h');
  }

  private SUB_A_L() {
    this.SUB_R_R('a', 'l');
  }

  private SUB_A_HLa() {
    this.SUB_R_RRa('a', 'h', 'l');
  }

  private SUB_A_A() {
    this.SUB_R_R('a', 'a');
  }

  // ***** [19th 8 ops] [0x90 - 0x97] ends  *****

  // ***** [20th 8 ops] [0x98 - 0x9f] starts  *****

  private SBC_A_B() {
    this.SBC_R_R('a', 'b');
  }

  private SBC_A_C() {
    this.SBC_R_R('a', 'c');
  }

  private SBC_A_D() {
    this.SBC_R_R('a', 'd');
  }

  private SBC_A_E() {
    this.SBC_R_R('a', 'e');
  }

  private SBC_A_H() {
    this.SBC_R_R('a', 'h');
  }

  private SBC_A_L() {
    this.SBC_R_R('a', 'l');
  }

  private SBC_A_HLa() {
    this.SBC_R_RRa('a', 'h', 'l');
  }

  private SBC_A_A() {
    this.SBC_R_R('a', 'a');
  }

  // ***** [20th 8 ops] [0x98 - 0x9f] ends  *****

  // ***** [21st 8 ops] [0xa0 - 0xa7] starts  *****

  private AND_A_B() {
    this.AND_R_R('a', 'b');
  }

  private AND_A_C() {
    this.AND_R_R('a', 'c');
  }

  private AND_A_D() {
    this.AND_R_R('a', 'd');
  }

  private AND_A_E() {
    this.AND_R_R('a', 'e');
  }

  private AND_A_H() {
    this.AND_R_R('a', 'h');
  }

  private AND_A_L() {
    this.AND_R_R('a', 'l');
  }

  private AND_A_HLa() {
    this.AND_R_RRa('a', 'h', 'l');
  }

  private AND_A_A() {
    this.AND_R_R('a', 'a');
  }

  // ***** [21st 8 ops] [0xa0 - 0xa7] ends  *****

  // ***** [22nd 8 ops] [0xa8 - 0xaf] starts  *****

  private XOR_A_B() {
    this.XOR_R_R('a', 'b');
  }

  private XOR_A_C() {
    this.XOR_R_R('a', 'c');
  }

  private XOR_A_D() {
    this.XOR_R_R('a', 'd');
  }

  private XOR_A_E() {
    this.XOR_R_R('a', 'e');
  }

  private XOR_A_H() {
    this.XOR_R_R('a', 'h');
  }

  private XOR_A_L() {
    this.XOR_R_R('a', 'l');
  }

  private XOR_A_HLa() {
    this.XOR_R_RRa('a', 'h', 'l');
  }

  private XOR_A_A() {
    this.XOR_R_R('a', 'a');
  }

  // ***** [22nd 8 ops] [0xa8 - 0xaf] ends  *****

  // ***** [23rd 8 ops] [0xb0 - 0xb7] starts  *****

  private OR_A_B() {
    this.OR_R_R('a', 'b');
  }

  private OR_A_C() {
    this.OR_R_R('a', 'c');
  }

  private OR_A_D() {
    this.OR_R_R('a', 'd');
  }

  private OR_A_E() {
    this.OR_R_R('a', 'e');
  }

  private OR_A_H() {
    this.OR_R_R('a', 'h');
  }

  private OR_A_L() {
    this.OR_R_R('a', 'l');
  }

  private OR_A_HLa() {
    this.OR_R_RRa('a', 'h', 'l');
  }

  private OR_A_A() {
    this.OR_R_R('a', 'a');
  }

  // ***** [23rd 8 ops] [0xb0 - 0xb7] ends  *****

  // ***** [24th 8 ops] [0xb8 - 0xbf] starts  *****

  private CP_A_B() {
    this.CP_R_R('a', 'b');
  }

  private CP_A_C() {
    this.CP_R_R('a', 'c');
  }

  private CP_A_D() {
    this.CP_R_R('a', 'd');
  }

  private CP_A_E() {
    this.CP_R_R('a', 'e');
  }

  private CP_A_H() {
    this.CP_R_R('a', 'h');
  }

  private CP_A_L() {
    this.CP_R_R('a', 'l');
  }

  private CP_A_HLa() {
    this.CP_R_RRa('a', 'h', 'l');
  }

  private CP_A_A() {
    this.CP_R_R('a', 'a');
  }

  // ***** [24th 8 ops] [0xb8 - 0xbf] ends  *****

  // ***** [25th 8 ops] [0xc0 - 0xc7] starts  *****

  private RET_NZ() {
    if (this.zeroFlag) {
      // not return
    } else {
      // return
      const lowerByte = this.readFromSpAndIncSp();
      const higherByte = this.readFromSpAndIncSp();
      this.#registers.pc = this.joinTwoByte(higherByte, lowerByte);
    }
  }

  private POP_BC() {
    this.POP_RR('b', 'c');
  }

  private JP_NZ_d16a() {
    if (this.zeroFlag) {
      // no jump
      this.pcInc();
      this.pcInc();
    } else {
      // jump
      this.RET();
    }
  }

  private JP_d16a() {
    const addrLowerByte = this.readFromPcAndIncPc();
    const addrHigherByte = this.readFromPcAndIncPc();
    const addr = this.joinTwoByte(addrHigherByte, addrLowerByte);

    this.#registers.pc = addr;
  }

  private CALL_NZ_d16a() {
    if (this.zeroFlag) {
      // no call
      this.pcInc();
      this.pcInc();
    } else {
      // call
      this.CALL_d16a();
    }
  }

  private PUSH_BC() {
    this.PUSH_RR('b', 'c');
  }

  private ADD_A_d8() {
    this.ADD_R_d8('a');
  }

  private RST_0() {
    this.RST_n(0);
  }

  // ***** [25th 8 ops] [0xc0 - 0xc7] ends  *****

  // ***** [26th 8 ops] [0xc8 - 0xcf] starts  *****

  private RET_Z() {
    if (this.zeroFlag) {
      // return
      this.RET();
    } else {
      // no return
    }
  }

  private RET() {
    const lowerByte = this.readFromSpAndIncSp();
    const higherByte = this.readFromSpAndIncSp();
    this.#registers.pc = this.joinTwoByte(higherByte, lowerByte);
  }

  private JP_Z_d16a() {
    if (this.zeroFlag) {
      // jump
      this.JP_d16a();
    } else {
      // nojump
      this.pcInc();
      this.pcInc();
    }
  }

  private CALL_OP_WITH_CB_PREFIX() {
    throw new Error('Not implemented yet! We will need another op map!');
  }

  private CALL_Z_d16_a() {
    if (this.zeroFlag) {
      // call
      this.CALL_d16a();
    } else {
      // no call
      this.pcInc();
      this.pcInc();
    }
  }

  private CALL_d16a() {
    const addrLowerByte = this.readFromPcAndIncPc();
    const addrHigherByte = this.readFromPcAndIncPc();
    const callAddr = this.joinTwoByte(addrHigherByte, addrLowerByte);

    this.DEC_doublyByteR('sp');
    this.#memory.writeByte(
      this.#registers.sp,
      lowerByteOfDoubleByte(this.#registers.pc)
    );
    this.DEC_doublyByteR('sp');
    this.#memory.writeByte(
      this.#registers.sp,
      lowerByteOfDoubleByte(this.#registers.pc)
    );

    this.#registers.pc = callAddr;
  }

  private ADC_A_d8() {
    this.ADC_R_d8('a');
  }

  private RST_1() {
    this.RST_n(1);
  }

  // ***** [26th 8 ops] [0xc8 - 0xcf] ends  *****

  // ***** [27th 8 ops] [0xd0 - 0xd7] starts  *****

  private RET_NC() {
    if (this.carryFlag) {
      // no return
    } else {
      // return
      this.RET();
    }
  }

  private POP_DE() {
    this.POP_RR('d', 'e');
  }

  private JP_NC_d16a() {
    if (this.carryFlag) {
      // no jump
      this.pcInc();
      this.pcInc();
    } else {
      // jump
      this.JP_d16a();
    }
  }

  // empty op

  private CALL_NC_d16a() {
    if (this.carryFlag) {
      // no call
      this.pcInc();
      this.pcInc();
    } else {
      // call
      this.CALL_d16a();
    }
  }

  private PUSH_DE() {
    this.PUSH_RR('d', 'e');
  }

  private SUB_A_d8() {
    this.SUB_R_d8('a');
  }

  private RST_2() {
    this.RST_n(2);
  }

  // ***** [27th 8 ops] [0xd0 - 0xd7] ends  *****

  // ***** [28th 8 ops] [0xd8 - 0xdf] starts  *****

  private RET_C() {
    if (this.carryFlag) {
      // ret
      this.RET();
    } else {
      // no ret
    }
  }

  private RETI() {
    this.RET();
    this.signal_io_device();
  }

  private JP_C_d16a() {
    if (this.carryFlag) {
      // jump
      this.JP_d16a();
    } else {
      // no jump
      this.pcInc();
      this.pcInc();
    }
  }

  // empty opcode

  private CALL_C_d16a() {
    if (!this.carryFlag) {
      // no call
      this.pcInc();
      this.pcInc();
    } else {
      // call
      this.CALL_d16a();
    }
  }

  // empty opcode

  private SBC_A_d8() {
    this.SBC_R_d8('a');
  }

  private RST_3() {
    this.RST_n(3);
  }

  // ***** [28th 8 ops] [0xd8 - 0xdf] ends  *****

  // ***** [29th 8 ops] [0xe0 - 0xe7] starts  *****

  private LD_d8a_A() {
    const d8 = this.readFromPcAndIncPc();
    const addr = addWithDoubleByte(0xFF00, d8);
    this.#memory.writeByte(addr, this.#registers.a);
  }

  private POP_HL() {
    this.POP_RR('h', 'l');
  }

  private LD_Ca_A() {
    const addr = this.#registers.c;
    this.#memory.writeByte(addr, this.#registers.a);
  }

  // empty opcode
  
  // empty opcode

  private PUSH_HL() {
    this.PUSH_RR('h', 'l');
  }

  private AND_d8() {
    const target = this.readFromPcAndIncPc();
    const source = this.#registers.a;

    const result = andWithOneByte(target, source);
    this.#registers.a = result;

    this.zeroFlag = shouldSetZeroFlag(result);
    this.substractionFlag = false;
    this.halfCarryFlag = true;
    this.carryFlag = false;
  }

  private RST_4() {
    this.RST_n(4);
  }

  // ***** [29th 8 ops] [0xe0 - 0xe7] ends  *****

  // ***** [30th 8 ops] [0xe8 - 0xef] starts  *****

  private ADD_SP_s8() {
    const notParsed8Bit = this.readFromPcAndIncPc();
    const parsed = parseAsSigned(notParsed8Bit, BitLength.OneByte);
    const sp = this.#registers.sp;
    const result = addWithDoubleByte(sp, parsed);
    this.#registers.sp = result;
    this.zeroFlag = false;
    this.substractionFlag = false;
    this.halfCarryFlag = shouldSetHalfCarryFlag(
      Operation.Add,
      BitLength.DoubleByte,
      sp,
      parsed
    );
    this.carryFlag = shouldSetCarryFlag(
      Operation.Add,
      BitLength.OneByte,
      sp,
      parsed
    );
  }

  private JP_HL() {
    const addr = this.joinRegisterPair('h', 'l');
    this.#registers.pc = addr;
  }

  private LD_d16a_A() {
    const addrLB = this.readFromPcAndIncPc();
    const addrHB = this.readFromPcAndIncPc();
    const addr = this.joinTwoByte(addrHB, addrLB);
    this.#memory.writeByte(addr, this.#registers.a);
  }

  // empty opcode

  // empty opcode

  // empty opcode

  private XOR_d8() {
    const registerVal = this.#registers.a;
    const val = this.readFromPcAndIncPc();

    const result = xorWithOneByte(registerVal, val);
    this.#registers.a = result;

    this.zeroFlag = shouldSetZeroFlag(result);
    this.substractionFlag = false;
    this.halfCarryFlag = false;
    this.carryFlag = false;
  }

  private RST_5() {
    this.RST_n(5);
  }

  // ***** [30th 8 ops] [0xe8 - 0xef] ends  *****
}

function shouldSetZeroFlag(result: number) {
  return result === 0;
}

function shouldSetHalfCarryFlag(
  operation: Operation,
  bitLength: number,
  left: number,
  ...rights: number[]
): boolean {
  assertEven(bitLength);
  const halfBitLength = bitLength / 2;
  return shouldSetCarryFlag(operation, halfBitLength, left, ...rights);
}

function shouldSetCarryFlag(
  operation: Operation,
  bitLength: number,
  left: number,
  ...rights: number[]
): boolean {
  const fullOnes = (1 << bitLength) - 1;

  let result = left & fullOnes;
  const rightsWithLimitedBits = rights.map((right) => right & fullOnes);

  if (operation === Operation.Add) {
    for (let rightWithLimitedBits of rightsWithLimitedBits) {
      result += rightWithLimitedBits;
      if ((result & (1 << bitLength)) !== 0) return true;
    }
    return false;
  } else if (operation === Operation.Minus) {
    for (let rightWithLimitedBits of rightsWithLimitedBits) {
      if (result < rightWithLimitedBits) {
        return true;
      } else {
        result = result - rightWithLimitedBits;
      }
    }
    return false;
  } else {
    throw new Error('Judging Carry: operation not implemented!');
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

function addWithOneByte(left: number, ...rights: number[]) {
  return performOperationOnOperandsWithBitLength(
    Operation.Add,
    BitLength.OneByte,
    left,
    ...rights
  );
}

function minusWithOneByte(left: number, ...rights: number[]) {
  return performOperationOnOperandsWithBitLength(
    Operation.Minus,
    BitLength.OneByte,
    left,
    ...rights
  );
}

function andWithOneByte(left: number, ...rights: number[]) {
  return performOperationOnOperandsWithBitLength(
    Operation.And,
    BitLength.OneByte,
    left,
    ...rights
  );
}

function xorWithOneByte(left: number, ...rights: number[]) {
  return performOperationOnOperandsWithBitLength(
    Operation.Xor,
    BitLength.OneByte,
    left,
    ...rights
  );
}

function orWithOneByte(left: number, ...rights: number[]) {
  return performOperationOnOperandsWithBitLength(
    Operation.Or,
    BitLength.OneByte,
    left,
    ...rights
  );
}

function addWithDoubleByte(left: number, ...rights: number[]) {
  return performOperationOnOperandsWithBitLength(
    Operation.Add,
    BitLength.DoubleByte,
    left,
    ...rights
  );
}

function minusWithDoubleByte(left: number, ...rights: number[]) {
  return performOperationOnOperandsWithBitLength(
    Operation.Minus,
    BitLength.DoubleByte,
    left,
    ...rights
  );
}

function performOperationOnOperandsWithBitLength(
  operation: Operation,
  bitLength: number,
  left: number,
  ...rights: number[]
) {
  const allOnes = (1 << bitLength) - 1;
  let result = left & allOnes;

  switch (operation) {
    case Operation.Add:
      rights.forEach((right) => {
        result = ((right & allOnes) + result) & allOnes;
      });
      break;
    case Operation.Minus:
      rights.forEach((right) => {
        result = (result - (right & allOnes)) & allOnes;
      });
      break;
    case Operation.And:
      rights.forEach((right) => {
        result = result & (right & allOnes);
      });
      break;
    case Operation.Xor:
      rights.forEach((right) => {
        result = result ^ (right & allOnes);
      });
      break;
    case Operation.Or:
      rights.forEach((right) => {
        result = result | (right & allOnes);
      });
      break;
    default:
      throw new Error('perform operation: not implemented!');
  }

  return result;
}

function lowerByteOfDoubleByte(val: number): number {
  return val & 0xff;
}

function higherByteOfDoubleByte(val: number): number {
  return (val & 0xff00) >> 8;
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
  And,
  Xor,
  Or,
}

enum BitLength {
  OneByte = 8,
  DoubleByte = 16,
}
