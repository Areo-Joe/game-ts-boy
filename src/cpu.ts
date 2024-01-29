import { CPUState } from '../jsmooTest';
import {
  IE_ADDR,
  IF_ADDR,
  INTERRUPT_HANDLER_ADDR_MAP,
  InterruptBit,
  PRIORITIZED_INTERRUPT_BITS,
} from './const';
import { GPU } from './gpu';
import { GBTimer } from './timer';
import {
  BitLength,
  Operation,
  addWithDoubleByte,
  addWithOneByte,
  minusWithOneByte,
  minusWithDoubleByte,
  xorWithOneByte,
  orWithOneByte,
  lowerByteOfDoubleByte,
  higherByteOfDoubleByte,
  andWithOneByte,
  assertEven,
  getLastBit,
  getFirstBit,
  getBit,
  signedExtend,
  setBit,
} from './utils';

// GB's cpu is a modified Z80, so...
// todo: it is not... just a same family
export class Z80 {
  #memory: MMU;
  #timer: GBTimer;
  #gpu: GPU;
  #halted = false;

  constructor(mmu: MMU, timer: GBTimer, gpu: GPU) {
    this.#memory = mmu;
    this.#timer = timer;
    this.#gpu = gpu;
  }

  #IME = false; // controls the overall interrupt's availablility
  #EI_DELAY = false; // EI works after 1 instruction dealy

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

    // measures the time used by each instruction, corresponding to m/t clock
    m: 0,
    t: 0,
  };

  // CPU clock, speed(m-clock) === 1 / 4 * speed(t-clock)
  // m-clock is the base speed
  // accumulated time
  #clock = {
    m: 0,
    t: 0,
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

    // 31st
    this.LD_A_d8a,
    this.POP_AF,
    this.LD_A_Ca,
    this.DI,
    this.EMPTY_OPCODE,
    this.PUSH_AF,
    this.OR_d8,
    this.RST_6,

    // 32nd
    this.LD_HL_SPPlusD8,
    this.LD_SP_HL,
    this.LD_A_d16a,
    this.EI,
    this.EMPTY_OPCODE,
    this.EMPTY_OPCODE,
    this.CP_d8,
    this.RST_7,
  ];

  #opMapCBPrefixed = [
    // 1st
    this.RLC_B,
    this.RLC_C,
    this.RLC_D,
    this.RLC_E,
    this.RLC_H,
    this.RLC_L,
    this.RLC_HLa,
    this.RLC_A,

    // 2nd
    this.RRC_B,
    this.RRC_C,
    this.RRC_D,
    this.RRC_E,
    this.RRC_H,
    this.RRC_L,
    this.RRC_HLa,
    this.RRC_A,

    // 3rd
    this.RL_B,
    this.RL_C,
    this.RL_D,
    this.RL_E,
    this.RL_H,
    this.RL_L,
    this.RL_HLa,
    this.RL_A,

    // 4th
    this.RR_B,
    this.RR_C,
    this.RR_D,
    this.RR_E,
    this.RR_H,
    this.RR_L,
    this.RR_HLa,
    this.RR_A,

    // 5th
    this.SLA_B,
    this.SLA_C,
    this.SLA_D,
    this.SLA_E,
    this.SLA_H,
    this.SLA_L,
    this.SLA_HLa,
    this.SLA_A,

    // 6th
    this.SRA_B,
    this.SRA_C,
    this.SRA_D,
    this.SRA_E,
    this.SRA_H,
    this.SRA_L,
    this.SRA_HLa,
    this.SRA_A,

    // 7th
    this.SWAP_B,
    this.SWAP_C,
    this.SWAP_D,
    this.SWAP_E,
    this.SWAP_H,
    this.SWAP_L,
    this.SWAP_HLa,
    this.SWAP_A,

    // 8th
    this.SRL_B,
    this.SRL_C,
    this.SRL_D,
    this.SRL_E,
    this.SRL_H,
    this.SRL_L,
    this.SRL_HLa,
    this.SRL_A,

    // 9th
    this.BIT_0_B,
    this.BIT_0_C,
    this.BIT_0_D,
    this.BIT_0_E,
    this.BIT_0_H,
    this.BIT_0_L,
    this.BIT_0_HLa,
    this.BIT_0_A,

    // 10th
    this.BIT_1_B,
    this.BIT_1_C,
    this.BIT_1_D,
    this.BIT_1_E,
    this.BIT_1_H,
    this.BIT_1_L,
    this.BIT_1_HLa,
    this.BIT_1_A,

    // 11th
    this.BIT_2_B,
    this.BIT_2_C,
    this.BIT_2_D,
    this.BIT_2_E,
    this.BIT_2_H,
    this.BIT_2_L,
    this.BIT_2_HLa,
    this.BIT_2_A,

    // 12th
    this.BIT_3_B,
    this.BIT_3_C,
    this.BIT_3_D,
    this.BIT_3_E,
    this.BIT_3_H,
    this.BIT_3_L,
    this.BIT_3_HLa,
    this.BIT_3_A,

    // 13th
    this.BIT_4_B,
    this.BIT_4_C,
    this.BIT_4_D,
    this.BIT_4_E,
    this.BIT_4_H,
    this.BIT_4_L,
    this.BIT_4_HLa,
    this.BIT_4_A,

    // 14th
    this.BIT_5_B,
    this.BIT_5_C,
    this.BIT_5_D,
    this.BIT_5_E,
    this.BIT_5_H,
    this.BIT_5_L,
    this.BIT_5_HLa,
    this.BIT_5_A,

    // 15th
    this.BIT_6_B,
    this.BIT_6_C,
    this.BIT_6_D,
    this.BIT_6_E,
    this.BIT_6_H,
    this.BIT_6_L,
    this.BIT_6_HLa,
    this.BIT_6_A,

    // 16th
    this.BIT_7_B,
    this.BIT_7_C,
    this.BIT_7_D,
    this.BIT_7_E,
    this.BIT_7_H,
    this.BIT_7_L,
    this.BIT_7_HLa,
    this.BIT_7_A,

    // 17th
    this.RES_0_B,
    this.RES_0_C,
    this.RES_0_D,
    this.RES_0_E,
    this.RES_0_H,
    this.RES_0_L,
    this.RES_0_HLa,
    this.RES_0_A,

    // 18th
    this.RES_1_B,
    this.RES_1_C,
    this.RES_1_D,
    this.RES_1_E,
    this.RES_1_H,
    this.RES_1_L,
    this.RES_1_HLa,
    this.RES_1_A,

    // 19th
    this.RES_2_B,
    this.RES_2_C,
    this.RES_2_D,
    this.RES_2_E,
    this.RES_2_H,
    this.RES_2_L,
    this.RES_2_HLa,
    this.RES_2_A,

    // 20th
    this.RES_3_B,
    this.RES_3_C,
    this.RES_3_D,
    this.RES_3_E,
    this.RES_3_H,
    this.RES_3_L,
    this.RES_3_HLa,
    this.RES_3_A,

    // 21th
    this.RES_4_B,
    this.RES_4_C,
    this.RES_4_D,
    this.RES_4_E,
    this.RES_4_H,
    this.RES_4_L,
    this.RES_4_HLa,
    this.RES_4_A,

    // 22th
    this.RES_5_B,
    this.RES_5_C,
    this.RES_5_D,
    this.RES_5_E,
    this.RES_5_H,
    this.RES_5_L,
    this.RES_5_HLa,
    this.RES_5_A,

    // 23th
    this.RES_6_B,
    this.RES_6_C,
    this.RES_6_D,
    this.RES_6_E,
    this.RES_6_H,
    this.RES_6_L,
    this.RES_6_HLa,
    this.RES_6_A,

    // 24th
    this.RES_7_B,
    this.RES_7_C,
    this.RES_7_D,
    this.RES_7_E,
    this.RES_7_H,
    this.RES_7_L,
    this.RES_7_HLa,
    this.RES_7_A,

    // 25th
    this.SET_0_B,
    this.SET_0_C,
    this.SET_0_D,
    this.SET_0_E,
    this.SET_0_H,
    this.SET_0_L,
    this.SET_0_HLa,
    this.SET_0_A,

    // 26th
    this.SET_1_B,
    this.SET_1_C,
    this.SET_1_D,
    this.SET_1_E,
    this.SET_1_H,
    this.SET_1_L,
    this.SET_1_HLa,
    this.SET_1_A,

    // 27th
    this.SET_2_B,
    this.SET_2_C,
    this.SET_2_D,
    this.SET_2_E,
    this.SET_2_H,
    this.SET_2_L,
    this.SET_2_HLa,
    this.SET_2_A,

    // 28th
    this.SET_3_B,
    this.SET_3_C,
    this.SET_3_D,
    this.SET_3_E,
    this.SET_3_H,
    this.SET_3_L,
    this.SET_3_HLa,
    this.SET_3_A,

    // 29th
    this.SET_4_B,
    this.SET_4_C,
    this.SET_4_D,
    this.SET_4_E,
    this.SET_4_H,
    this.SET_4_L,
    this.SET_4_HLa,
    this.SET_4_A,

    // 30th
    this.SET_5_B,
    this.SET_5_C,
    this.SET_5_D,
    this.SET_5_E,
    this.SET_5_H,
    this.SET_5_L,
    this.SET_5_HLa,
    this.SET_5_A,

    // 31th
    this.SET_6_B,
    this.SET_6_C,
    this.SET_6_D,
    this.SET_6_E,
    this.SET_6_H,
    this.SET_6_L,
    this.SET_6_HLa,
    this.SET_6_A,

    // 32th
    this.SET_7_B,
    this.SET_7_C,
    this.SET_7_D,
    this.SET_7_E,
    this.SET_7_H,
    this.SET_7_L,
    this.SET_7_HLa,
    this.SET_7_A,
  ];

  setState({ pc, sp, a, b, c, d, e, f, h, l, ram }: CPUState) {
    this.#registers.pc = pc;
    this.#registers.a = a;
    this.#registers.f = f;
    this.#registers.b = b;
    this.#registers.c = c;
    this.#registers.d = d;
    this.#registers.e = e;
    this.#registers.h = h;
    this.#registers.l = l;
    this.#registers.sp = sp;
    for (let i = 0; i < ram.length; i++) {
      this.#memory.writeByte(ram[i][0], ram[i][1]);
    }
  }

  compareState({ pc, sp, a, b, c, d, e, f, h, l, ram }: CPUState) {
    if (
      this.#registers.pc === pc &&
      this.#registers.a === a &&
      this.#registers.f === f &&
      this.#registers.b === b &&
      this.#registers.c === c &&
      this.#registers.d === d &&
      this.#registers.e === e &&
      this.#registers.h === h &&
      this.#registers.l === l &&
      this.#registers.sp === sp
    ) {
      const localRam: Array<[number, number]> = [];
      let same = true;
      for (let i = 0; i < ram.length; i++) {
        const val = this.#memory.readByte(ram[i][0]);
        localRam.push([ram[i][0], val]);
        if (val !== ram[i][1]) {
          same = false;
        }
      }
      return same
        ? true
        : JSON.stringify({ registers: this.#registers, ram: localRam });
    } else {
      const localRam: Array<[number, number]> = [];
      for (let i = 0; i < ram.length; i++) {
        const val = this.#memory.readByte(ram[i][0]);
        localRam.push([ram[i][0], val]);
      }
      return JSON.stringify(
        { registers: this.#registers, ram: localRam },
        null,
        4
      );
    }
  }

  runOnce() {
    const opcode = this.readFromPcAndIncPc();
    const func = this.#opMap[opcode];
    opcode !== 0 && console.log(func, opcode);
    return func.call(this);
  }

  run() {
    const checkHandler = (IE: number, IF: number) => {
      for (let i = 0; i < PRIORITIZED_INTERRUPT_BITS.length; i++) {
        const interruptBit = PRIORITIZED_INTERRUPT_BITS[i];
        if (
          this.getInterruptEnabled(IE, interruptBit) &&
          this.getInterruptFlag(IF, interruptBit)
        ) {
          this.#IME = false;
          this.IF = this.setInterruptFlag(IF, interruptBit, false);
          // push pc
          this.DEC_doubleByteR('sp');
          this.#memory.writeByte(
            this.#registers.sp,
            higherByteOfDoubleByte(this.#registers.pc)
          );
          this.DEC_doubleByteR('sp');
          this.#memory.writeByte(
            this.#registers.sp,
            lowerByteOfDoubleByte(this.#registers.pc)
          );
          // jump to handler
          this.#registers.pc = INTERRUPT_HANDLER_ADDR_MAP.get(interruptBit)!;
          this.#timer.inc(5);
          break;
        }
      }
    };
    while (true) {
      if (!this.#halted) {
        this.#EI_DELAY = false;
        const timeConsumed = this.runOnce();
        this.#timer.inc(timeConsumed);

        if (this.#EI_DELAY) {
          continue;
        }
        if (!this.#IME) {
          continue;
        }
        const IE = this.IE;
        const IF = this.IF;
        checkHandler(IE, IF);
      } else {
        this.#timer.inc(1);
        const IE = this.IE;
        const IF = this.IF;
        if ((IE & IF) === 0) {
          (IE !== 0 || IF !== 0) && console.log('continue', IE, IF);
          continue;
        }
        this.#halted = false;
        if (!this.#IME) {
          continue;
        }
        checkHandler(IE, IF);
      }
    }
  }

  reset() {
    const registers = this.#registers;
    (
      'a b c d e f h l pc sp m t'.split(' ') as (keyof typeof registers)[]
    ).forEach((r) => (registers[r] = 0));

    this.#clock.m = 0;
    this.#clock.t = 0;
  }

  clearFlag() {
    this.#registers.f = 0;
  }

  private spendTime(mClock: number) {
    this.#registers.t = mClock * 4;
    this.#registers.m = mClock;
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

  private get IE() {
    return this.#memory.readByte(IE_ADDR);
  }

  private set IE(val: number) {
    this.#memory.writeByte(IE_ADDR, val);
  }

  private getInterruptEnabled(IE: number, interruptBit: InterruptBit) {
    return getBit(IE, interruptBit) === 1;
  }

  private setInterruptEnabled(
    IE: number,
    interruptBit: InterruptBit,
    val: boolean
  ) {
    return setBit(IE, interruptBit, val ? 1 : 0);
  }

  private get IF() {
    return this.#memory.readByte(IF_ADDR);
  }

  private set IF(val: number) {
    this.#memory.writeByte(IF_ADDR, val);
  }

  private getInterruptFlag(IF: number, interruptBit: InterruptBit) {
    return getBit(IF, interruptBit) === 1;
  }

  private setInterruptFlag(
    IF: number,
    interruptBit: InterruptBit,
    val: boolean
  ) {
    return setBit(IF, interruptBit, val ? 1 : 0);
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
    return 3 as const;
  }

  private LD_doubleByteR_d16(doubleBytreRegister: Z80DoubleByteRegisters) {
    const lowerByte = this.readFromPcAndIncPc();
    const higherByte = this.readFromPcAndIncPc();
    this.#registers[doubleBytreRegister] = this.joinTwoByte(
      higherByte,
      lowerByte
    );

    return 3 as const;
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

    return 2 as const;
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

    return 2 as const;
  }

  private INC_doubleByteR(doubleByteRegister: Z80DoubleByteRegisters) {
    this.#registers[doubleByteRegister] = addWithDoubleByte(
      this.#registers[doubleByteRegister],
      1
    );

    return 2 as const;
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

    return 1 as const;
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

    return 1 as const;
  }

  private LD_R_d8(register: Z80SingleByteRegisters) {
    this.#registers[register] = this.readFromPcAndIncPc();

    return 2 as const;
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
    // yeah 12 is confusingly correct
    this.halfCarryFlag = shouldSetCarryFlag(Operation.Add, 12, target, source);
    this.carryFlag = shouldSetCarryFlag(
      Operation.Add,
      BitLength.DoubleByte,
      target,
      source
    );

    return 2 as const;
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

    return 2 as const;
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

    return 2 as const;
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

    return 2 as const;
  }

  private DEC_doubleByteR(doubleByteRegister: Z80DoubleByteRegisters) {
    const val = this.#registers[doubleByteRegister];
    this.#registers[doubleByteRegister] = minusWithDoubleByte(val, 1);

    return 2 as const;
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

    return 3 as const;
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

    return 3 as const;
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

    return 3 as const;
  }

  private LD_R_R(
    targetRegister: Z80SingleByteRegisters,
    sourceRegister: Z80SingleByteRegisters
  ) {
    this.#registers[targetRegister] = this.#registers[sourceRegister];

    return 1 as const;
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

    return 1 as const;
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

    return 2 as const;
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

    return 1 as const;
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

    return 2 as const;
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

    return 1 as const;
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

    return 2 as const;
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
    this.substractionFlag = true;
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

    return 1 as const;
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
    this.substractionFlag = true;
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

    return 2 as const;
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

    return 1 as const;
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

    return 2 as const;
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

    return 1 as const;
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

    return 2 as const;
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

    return 1 as const;
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

    return 2 as const;
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

    return 1 as const;
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

    return 2 as const;
  }

  private POP_RR(
    higherByteRegister: Z80SingleByteRegisters,
    lowerByteRegister: Z80SingleByteRegisters
  ) {
    this.#registers[lowerByteRegister] = this.readFromSpAndIncSp();
    this.#registers[higherByteRegister] = this.readFromSpAndIncSp();

    return 3 as const;
  }

  private PUSH_RR(
    higherByteRegister: Z80SingleByteRegisters,
    lowerByteRegister: Z80SingleByteRegisters
  ) {
    this.DEC_doubleByteR('sp');
    this.#memory.writeByte(
      this.#registers.sp,
      this.#registers[higherByteRegister]
    );
    this.DEC_doubleByteR('sp');
    this.#memory.writeByte(
      this.#registers.sp,
      this.#registers[lowerByteRegister]
    );

    return 4 as const;
  }

  private PUSH_doubleByteR(doubleByteRegister: Z80DoubleByteRegisters) {
    this.DEC_doubleByteR('sp');
    this.#memory.writeByte(
      this.#registers.sp,
      higherByteOfDoubleByte(this.#registers[doubleByteRegister])
    );
    this.DEC_doubleByteR('sp');
    this.#memory.writeByte(
      this.#registers.sp,
      lowerByteOfDoubleByte(this.#registers[doubleByteRegister])
    );
  }

  private ADD_R_d8(targetRegister: Z80SingleByteRegisters) {
    const registerVal = this.#registers[targetRegister];
    const val = this.readFromPcAndIncPc();

    const result = addWithOneByte(registerVal, val);
    this.#registers[targetRegister] = result;

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

    return 2 as const;
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

    this.#registers[targetRegister] = result;

    return 2 as const;
  }

  private SUB_R_d8(targetRegister: Z80SingleByteRegisters) {
    const registerVal = this.#registers[targetRegister];
    const val = this.readFromPcAndIncPc();

    const result = minusWithOneByte(registerVal, val);
    this.#registers[targetRegister] = result;

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

    return 2 as const;
  }

  private SBC_R_d8(targetRegister: Z80SingleByteRegisters) {
    const registerVal = this.#registers[targetRegister];
    const val = this.readFromPcAndIncPc();

    const result = minusWithOneByte(registerVal, val, this.carryFlag ? 1 : 0);

    this.#registers[targetRegister] = result;

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

    return 2 as const;
  }

  private RST_n(n: number) {
    this.PUSH_doubleByteR('pc');
    this.#registers.pc = 0x0008 * n;

    return 4 as const;
  }

  private EMPTY_OPCODE() {
    console.error('This op should not be called!');
    return 0 as const;
  }

  private signal_io_device() {
    throw new Error('Signaling device is currently unimplemented!');
  }

  private LD_d8a_R(sourceRegister: Z80SingleByteRegisters) {
    const d8 = this.readFromPcAndIncPc();
    const addr = addWithDoubleByte(0xff00, d8);
    this.#memory.writeByte(addr, this.#registers[sourceRegister]);

    return 3 as const;
  }

  private LD_Ra_R(
    targetRegister: Z80SingleByteRegisters,
    sourceRegister: Z80SingleByteRegisters
  ) {
    const halfAddr = this.#registers[targetRegister];
    const addr = addWithDoubleByte(0xff00, halfAddr);
    this.#memory.writeByte(addr, this.#registers[sourceRegister]);

    return 2 as const;
  }

  private LD_d16a_R(sourceRegister: Z80SingleByteRegisters) {
    const addrLB = this.readFromPcAndIncPc();
    const addrHB = this.readFromPcAndIncPc();
    const addr = this.joinTwoByte(addrHB, addrLB);
    this.#memory.writeByte(addr, this.#registers[sourceRegister]);

    return 4 as const;
  }

  private LD_R_d8a(targetRegister: Z80SingleByteRegisters) {
    const halfAddr = this.readFromPcAndIncPc();
    const addr = addWithDoubleByte(0xff00, halfAddr);
    const val = this.#memory.readByte(addr);
    this.#registers[targetRegister] = val;

    return 3 as const;
  }

  private LD_R_Ra(
    targetRegister: Z80SingleByteRegisters,
    sourceRegister: Z80SingleByteRegisters
  ) {
    const sourceHalfAddr = this.#registers[sourceRegister];
    const sourceAddr = addWithDoubleByte(0xff00, sourceHalfAddr);
    const val = this.#memory.readByte(sourceAddr);
    this.#registers[targetRegister] = val;

    return 2 as const;
  }

  private LD_R_d16a(targetRegister: Z80SingleByteRegisters) {
    const addrL = this.readFromPcAndIncPc();
    const addrH = this.readFromPcAndIncPc();
    const addr = this.joinTwoByte(addrH, addrL);
    const val = this.#memory.readByte(addr);
    this.#registers[targetRegister] = val;

    return 4 as const;
  }

  private RLC_R(register: Z80SingleByteRegisters) {
    const val = this.#registers[register];
    const lastBit = getLastBit(val, BitLength.OneByte);
    const result = ((val & 0b0111_1111) << 1) + lastBit;
    this.#registers[register] = result;
    this.carryFlag = lastBit === 1;
    this.zeroFlag = shouldSetZeroFlag(result);
    this.substractionFlag = false;
    this.halfCarryFlag = false;

    return 2 as const;
  }

  private RLC_RRa(
    addrHigherByteRegister: Z80SingleByteRegisters,
    addrLowerByteRegister: Z80SingleByteRegisters
  ) {
    const addr = this.joinRegisterPair(
      addrHigherByteRegister,
      addrLowerByteRegister
    );
    const val = this.#memory.readByte(addr);
    const lastBit = getLastBit(val, BitLength.OneByte);
    const result = ((val & 0b0111_1111) << 1) + lastBit;
    this.#memory.writeByte(addr, result);
    this.carryFlag = lastBit === 1;
    this.zeroFlag = shouldSetZeroFlag(result);
    this.substractionFlag = false;
    this.halfCarryFlag = false;

    return 4 as const;
  }

  private RRC_R(register: Z80SingleByteRegisters) {
    const val = this.#registers[register];
    const firstBit = getFirstBit(val);
    const result = ((val & 0b1111_1110) >> 1) | (firstBit << 7);
    this.#registers[register] = result;
    this.carryFlag = firstBit === 1;
    this.zeroFlag = shouldSetZeroFlag(result);
    this.substractionFlag = false;
    this.halfCarryFlag = false;

    return 2 as const;
  }

  private RRC_RRa(
    addrHigherByteRegister: Z80SingleByteRegisters,
    addrLowerByteRegister: Z80SingleByteRegisters
  ) {
    const addr = this.joinRegisterPair(
      addrHigherByteRegister,
      addrLowerByteRegister
    );
    const val = this.#memory.readByte(addr);
    const firstBit = getFirstBit(val);
    const result = ((val & 0b1111_1110) >> 1) | (firstBit << 7);
    this.#memory.writeByte(addr, result);
    this.carryFlag = firstBit === 1;
    this.zeroFlag = shouldSetZeroFlag(result);
    this.substractionFlag = false;
    this.halfCarryFlag = false;

    return 4 as const;
  }

  private RL_R(register: Z80SingleByteRegisters) {
    const val = this.#registers[register];
    const lastBit = getLastBit(val, BitLength.OneByte);
    const add = this.carryFlag ? 1 : 0;
    const result = ((val & 0b0111_1111) << 1) + add;
    this.#registers[register] = result;
    this.carryFlag = lastBit === 1;
    this.zeroFlag = shouldSetZeroFlag(result);
    this.substractionFlag = false;
    this.halfCarryFlag = false;

    return 2 as const;
  }

  private RL_RRa(
    addrHigherByteRegister: Z80SingleByteRegisters,
    addrLowerByteRegister: Z80SingleByteRegisters
  ) {
    const addr = this.joinRegisterPair(
      addrHigherByteRegister,
      addrLowerByteRegister
    );
    const val = this.#memory.readByte(addr);
    const lastBit = getLastBit(val, BitLength.OneByte);
    const add = this.carryFlag ? 1 : 0;
    const result = ((val & 0b0111_1111) << 1) + add;
    this.#memory.writeByte(addr, result);
    this.carryFlag = lastBit === 1;
    this.zeroFlag = shouldSetZeroFlag(result);
    this.substractionFlag = false;
    this.halfCarryFlag = false;

    return 4 as const;
  }

  private RR_R(register: Z80SingleByteRegisters) {
    const val = this.#registers[register];
    const firstBit = getFirstBit(val);
    const add = this.carryFlag ? 1 : 0;
    const result = ((val & 0b1111_1110) >> 1) + (add << 7);
    this.#registers[register] = result;
    this.carryFlag = firstBit === 1;
    this.zeroFlag = shouldSetZeroFlag(result);
    this.substractionFlag = false;
    this.halfCarryFlag = false;

    return 2 as const;
  }

  private RR_RRa(
    addrHigherByteRegister: Z80SingleByteRegisters,
    addrLowerByteRegister: Z80SingleByteRegisters
  ) {
    const addr = this.joinRegisterPair(
      addrHigherByteRegister,
      addrLowerByteRegister
    );
    const val = this.#memory.readByte(addr);
    const firstBit = getFirstBit(val);
    const add = this.carryFlag ? 1 : 0;
    const result = ((val & 0b1111_1110) >> 1) + (add << 7);
    this.#memory.writeByte(addr, result);
    this.carryFlag = firstBit === 1;
    this.zeroFlag = shouldSetZeroFlag(result);
    this.substractionFlag = false;
    this.halfCarryFlag = false;

    return 4 as const;
  }

  private SLA_R(register: Z80SingleByteRegisters) {
    const val = this.#registers[register];
    const lastBit = getLastBit(val, BitLength.OneByte);
    const result = (val & 0b0111_1111) << 1;
    this.#registers[register] = result;
    this.carryFlag = lastBit === 1;
    this.zeroFlag = shouldSetZeroFlag(result);
    this.substractionFlag = false;
    this.halfCarryFlag = false;

    return 2 as const;
  }

  private SLA_RRa(
    addrHigherByteRegister: Z80SingleByteRegisters,
    addrLowerByteRegister: Z80SingleByteRegisters
  ) {
    const addr = this.joinRegisterPair(
      addrHigherByteRegister,
      addrLowerByteRegister
    );
    const val = this.#memory.readByte(addr);
    const lastBit = getLastBit(val, BitLength.OneByte);
    const result = (val & 0b0111_1111) << 1;
    this.#memory.writeByte(addr, result);
    this.carryFlag = lastBit === 1;
    this.zeroFlag = shouldSetZeroFlag(result);
    this.substractionFlag = false;
    this.halfCarryFlag = false;

    return 4 as const;
  }

  private SRA_R(register: Z80SingleByteRegisters) {
    const val = this.#registers[register];
    const firstBit = getFirstBit(val);
    const lastBit = getLastBit(val, BitLength.OneByte);
    const result = ((val & 0b1111_1110) >> 1) + (lastBit << 7);
    this.#registers[register] = result;
    this.carryFlag = firstBit === 1;
    this.zeroFlag = shouldSetZeroFlag(result);
    this.substractionFlag = false;
    this.halfCarryFlag = false;

    return 2 as const;
  }

  private SRA_RRa(
    addrHigherByteRegister: Z80SingleByteRegisters,
    addrLowerByteRegister: Z80SingleByteRegisters
  ) {
    const addr = this.joinRegisterPair(
      addrHigherByteRegister,
      addrLowerByteRegister
    );
    const val = this.#memory.readByte(addr);
    const firstBit = getFirstBit(val);
    const lastBit = getLastBit(val, BitLength.OneByte);
    const result = ((val & 0b1111_1110) >> 1) + (lastBit << 7);
    this.#memory.writeByte(addr, result);
    this.carryFlag = firstBit === 1;
    this.zeroFlag = shouldSetZeroFlag(result);
    this.substractionFlag = false;
    this.halfCarryFlag = false;

    return 4 as const;
  }

  private SWAP_R(register: Z80SingleByteRegisters) {
    const val = this.#registers[register];
    const highHalf = (val & 0xf0) >> 4;
    const lowHalf = val & 0x0f;
    const result = (lowHalf << 4) + highHalf;
    this.#registers[register] = result;
    this.carryFlag = false;
    this.zeroFlag = shouldSetZeroFlag(result);
    this.substractionFlag = false;
    this.halfCarryFlag = false;

    return 2 as const;
  }

  private SWAP_RRa(
    addrHigherByteRegister: Z80SingleByteRegisters,
    addrLowerByteRegister: Z80SingleByteRegisters
  ) {
    const addr = this.joinRegisterPair(
      addrHigherByteRegister,
      addrLowerByteRegister
    );
    const val = this.#memory.readByte(addr);
    const highHalf = (val & 0xf0) >> 4;
    const lowHalf = val & 0x0f;
    const result = (lowHalf << 4) + highHalf;
    this.#memory.writeByte(addr, result);
    this.carryFlag = false;
    this.zeroFlag = shouldSetZeroFlag(result);
    this.substractionFlag = false;
    this.halfCarryFlag = false;

    return 4 as const;
  }

  private SRL_R(register: Z80SingleByteRegisters) {
    const val = this.#registers[register];
    const firstBit = getFirstBit(val);
    const result = (val & 0b1111_1110) >> 1;
    this.#registers[register] = result;
    this.carryFlag = firstBit === 1;
    this.zeroFlag = shouldSetZeroFlag(result);
    this.substractionFlag = false;
    this.halfCarryFlag = false;

    return 2 as const;
  }

  private SRL_RRa(
    addrHigherByteRegister: Z80SingleByteRegisters,
    addrLowerByteRegister: Z80SingleByteRegisters
  ) {
    const addr = this.joinRegisterPair(
      addrHigherByteRegister,
      addrLowerByteRegister
    );
    const val = this.#memory.readByte(addr);
    const firstBit = getFirstBit(val);
    const result = (val & 0b1111_1110) >> 1;
    this.#memory.writeByte(addr, result);
    this.carryFlag = firstBit === 1;
    this.zeroFlag = shouldSetZeroFlag(result);
    this.substractionFlag = false;
    this.halfCarryFlag = false;

    return 4 as const;
  }

  private BIT_n_R(n: number, register: Z80SingleByteRegisters) {
    const val = this.#registers[register];
    const bit = getBit(val, n);
    this.zeroFlag = bit === 0;
    this.substractionFlag = false;
    this.halfCarryFlag = true;

    return 2 as const;
  }

  private BIT_n_RRa(
    n: number,
    addrHigherByteRegister: Z80SingleByteRegisters,
    addrLowerByteRegister: Z80SingleByteRegisters
  ) {
    const addr = this.joinRegisterPair(
      addrHigherByteRegister,
      addrLowerByteRegister
    );
    const val = this.#memory.readByte(addr);
    const bit = getBit(val, n);
    this.zeroFlag = bit === 0;
    this.substractionFlag = false;
    this.halfCarryFlag = true;

    return 3 as const;
  }

  private RES_n_R(n: number, register: Z80SingleByteRegisters) {
    const val = this.#registers[register];
    const result = val & (~(1 << n) & 0xff);
    this.#registers[register] = result;

    return 2 as const;
  }

  private RES_n_RRa(
    n: number,
    addrHigherByteRegister: Z80SingleByteRegisters,
    addrLowerByteRegister: Z80SingleByteRegisters
  ) {
    const addr = this.joinRegisterPair(
      addrHigherByteRegister,
      addrLowerByteRegister
    );
    const val = this.#memory.readByte(addr);
    const result = val & (~(1 << n) & 0xff);
    this.#memory.writeByte(addr, result);

    return 4 as const;
  }

  private SET_n_R(n: number, register: Z80SingleByteRegisters) {
    const val = this.#registers[register];
    const result = val | (1 << n);
    this.#registers[register] = result;

    return 2 as const;
  }

  private SET_n_RRa(
    n: number,
    addrHigherByteRegister: Z80SingleByteRegisters,
    addrLowerByteRegister: Z80SingleByteRegisters
  ) {
    const addr = this.joinRegisterPair(
      addrHigherByteRegister,
      addrLowerByteRegister
    );
    const val = this.#memory.readByte(addr);
    const result = val | (1 << n);
    this.#memory.writeByte(addr, result);

    return 4 as const;
  }

  // ***** General Ops ends *****

  // ***** [1st 8 ops] [0x00 - 0x07] starts *****

  private NOP() {
    return 1 as const;
  }

  private LD_BC_d16() {
    return this.LD_RR_d16('b', 'c');
  }

  private LD_BCa_A() {
    return this.LD_RRa_R('b', 'c', 'a');
  }

  private INC_BC() {
    return this.INC_RR('b', 'c');
  }

  private INC_B() {
    return this.INC_R('b');
  }

  private DEC_B() {
    return this.DEC_R('b');
  }

  private LD_B_d8() {
    return this.LD_R_d8('b');
  }

  private RLCA() {
    const lastBit = (this.#registers.a & (0x1 << 7)) !== 0 ? 1 : 0;
    const leftOne = ((this.#registers.a & 0xff) << 1) & 0xff;
    const result = (leftOne & ~1) | lastBit;
    this.#registers.a = result;
    this.zeroFlag = false;
    this.substractionFlag = false;
    this.halfCarryFlag = false;
    this.carryFlag = lastBit === 1;

    return 1 as const;
  }

  // ***** [1st 8 ops] [0x00 - 0x07] ends *****

  // ***** [2nd 8 ops] [0x08 - 0x0f] starts *****

  private LD_d16a_SP() {
    const addrLB = this.readFromPcAndIncPc();
    const addrHB = this.readFromPcAndIncPc();
    const addr = this.joinTwoByte(addrHB, addrLB);
    this.#memory.writeDoubleByte(addr, this.#registers.sp);

    return 5 as const;
  }

  private ADD_HL_BC() {
    return this.ADD_RR_RR('h', 'l', 'b', 'c');
  }

  private LD_A_BCa() {
    return this.LD_R_RRa('a', 'b', 'c');
  }

  private DEC_BC() {
    return this.DEC_RR('b', 'c');
  }

  private INC_C() {
    return this.INC_R('c');
  }

  private DEC_C() {
    return this.DEC_R('c');
  }

  private LD_C_d8() {
    return this.LD_R_d8('c');
  }

  private RRCA() {
    const a = this.#registers.a & 0xff;
    const firstBit = 1 & a;
    this.#registers.a = (0xff & (a >> 1) & ((1 << 7) - 1)) | (firstBit << 7);
    this.zeroFlag = false;
    this.substractionFlag = false;
    this.halfCarryFlag = false;
    this.carryFlag = firstBit === 1;

    return 1 as const;
  }

  // ***** [2nd 8 ops] [0x08 - 0x0f] ends *****

  // ***** [3rd 8 ops] [0x10 - 0x17] ends *****

  private Stop() {
    // todo: check usage

    return 1 as const;
  }

  private LD_DE_d16() {
    return this.LD_RR_d16('d', 'e');
  }

  private LD_DEa_A() {
    return this.LD_RRa_R('d', 'e', 'a');
  }

  private INC_DE() {
    return this.INC_RR('d', 'e');
  }

  private INC_D() {
    return this.INC_R('d');
  }

  private DEC_D() {
    return this.DEC_R('d');
  }

  private LD_D_d8() {
    return this.LD_R_d8('d');
  }

  private RLA() {
    const a = this.#registers.a;
    const lastBit = (a & (1 << 7)) >> 7;
    const movedLeft = (a << 1) & 0xff;
    const result = (movedLeft & ~1) | (this.carryFlag ? 1 : 0);
    this.#registers.a = result;
    this.zeroFlag = false;
    this.substractionFlag = false;
    this.halfCarryFlag = false;
    this.carryFlag = lastBit === 0 ? false : true;

    return 1 as const;
  }

  // ***** [3rd 8 ops] [0x10 - 0x17] ends *****

  // ***** [4th 8 ops] [0x18 - 0x1f] starts *****

  private JR_s8() {
    const notExtended = this.readFromPcAndIncPc();
    const extended = signedExtend(
      notExtended,
      BitLength.OneByte,
      BitLength.DoubleByte
    );
    this.#registers.pc = addWithDoubleByte(this.#registers.pc, extended);

    return 3 as const;
  }

  private ADD_HL_DE() {
    return this.ADD_RR_RR('h', 'l', 'd', 'e');
  }

  private LD_A_DEa() {
    return this.LD_R_RRa('a', 'd', 'e');
  }

  private DEC_DE() {
    return this.DEC_RR('d', 'e');
  }

  private INC_E() {
    return this.INC_R('e');
  }

  private DEC_E() {
    return this.DEC_R('e');
  }

  private LD_E_d8() {
    return this.LD_R_d8('e');
  }

  private RRA() {
    const carryFlag = this.carryFlag;
    const firstBit = getFirstBit(this.#registers.a);
    const movedRight = (this.#registers.a >> 1) & 0b0111_1111;
    const registerResult = movedRight + ((carryFlag ? 1 : 0) << 7);
    this.carryFlag = firstBit === 1 ? true : false;
    this.zeroFlag = false;
    this.substractionFlag = false;
    this.halfCarryFlag = false;
    this.#registers.a = registerResult;

    return 1 as const;
  }

  // ***** [4th 8 ops] [0x18 - 0x1f] ends *****

  // ***** [5th 8 ops] [0x20 - 0x27] starts *****

  private JR_NZ_s8() {
    if (this.zeroFlag) {
      // no jump
      this.pcInc();
      return 2 as const;
    } else {
      // jump
      return this.JR_s8();
    }
  }

  private LD_HL_d16() {
    return this.LD_RR_d16('h', 'l');
  }

  private LD_HLa_A_and_INC_HL() {
    this.LD_RRa_R('h', 'l', 'a');
    this.INC_RR('h', 'l');

    return 2 as const;
  }

  private INC_HL() {
    return this.INC_RR('h', 'l');
  }

  private INC_H() {
    return this.INC_R('h');
  }

  private DEC_H() {
    return this.DEC_R('h');
  }

  private LD_H_d8() {
    return this.LD_R_d8('h');
  }

  private DAA() {
    let a = this.#registers.a;
    if (this.substractionFlag) {
      if (this.carryFlag) {
        a = minusWithOneByte(a, 0x60);
      }
      if (this.halfCarryFlag) {
        a = minusWithOneByte(a, 0x06);
      }
    } else {
      if (this.carryFlag || a > 0x99) {
        a = addWithOneByte(a, 0x60);
        this.carryFlag = true;
      }
      if (this.halfCarryFlag || (a & 0x0f) > 0x09) {
        a = addWithOneByte(a, 0x06);
      }
    }

    this.zeroFlag = shouldSetZeroFlag(a);
    this.halfCarryFlag = false;
    this.#registers.a = a;

    return 1 as const;
  }

  // ***** [5th 8 ops] [0x20 - 0x27] ends *****

  // ***** [6th 8 ops] [0x28 - 0x2f] starts *****

  private JR_Z_s8() {
    if (this.zeroFlag) {
      // jump
      return this.JR_s8();
    } else {
      // no jump
      this.pcInc();

      return 2 as const;
    }
  }

  private ADD_HL_HL() {
    return this.ADD_RR_RR('h', 'l', 'h', 'l');
  }

  private LD_A_HLa_and_INC_HL() {
    this.LD_R_RRa('a', 'h', 'l');
    this.INC_RR('h', 'l');

    return 2 as const;
  }

  private DEC_HL() {
    return this.DEC_RR('h', 'l');
  }

  private INC_L() {
    return this.INC_R('l');
  }

  private DEC_L() {
    return this.DEC_R('l');
  }

  private LD_L_d8() {
    return this.LD_R_d8('l');
  }

  private CPL() {
    this.#registers.a = ~this.#registers.a & 0xff;
    this.substractionFlag = true;
    this.halfCarryFlag = true;

    return 1 as const;
  }

  // ***** [6th 8 ops] [0x28 - 0x2f] ends *****

  // ***** [7th 8 ops] [0x30 - 0x37] starts *****

  private JR_NC_s8() {
    if (this.carryFlag) {
      // no jump
      this.pcInc();

      return 2 as const;
    } else {
      return this.JR_s8();
    }
  }

  private LD_SP_d16() {
    return this.LD_doubleByteR_d16('sp');
  }

  private LD_HLa_A_and_DEC_HL() {
    this.LD_RRa_R('h', 'l', 'a');
    this.DEC_HL();

    return 2 as const;
  }

  private INC_SP() {
    return this.INC_doubleByteR('sp');
  }

  private INC_HLa() {
    return this.INC_RRa('h', 'l');
  }

  private DEC_HLa() {
    return this.DEC_RRa('h', 'l');
  }

  private LD_HLa_d8() {
    return this.LD_RRa_d8('h', 'l');
  }

  private SCF() {
    this.substractionFlag = false;
    this.halfCarryFlag = false;
    this.carryFlag = true;

    return 1 as const;
  }

  // ***** [7th 8 ops] [0x30 - 0x37] ends *****

  // ***** [8th 8 ops] [0x38 - 0x3f] starts *****

  private JR_C_s8() {
    if (this.carryFlag) {
      // jump
      return this.JR_s8();
    } else {
      // no jump
      this.pcInc();

      return 2 as const;
    }
  }

  private ADD_HL_SP() {
    const source = this.#registers.sp;
    const target = this.joinRegisterPair('h', 'l');
    const result = addWithDoubleByte(target, source);
    this.distributeToRegisterPair('h', 'l', result);
    this.substractionFlag = false;
    // yeah 12 is correct
    this.halfCarryFlag = shouldSetCarryFlag(Operation.Add, 12, target, source);
    this.carryFlag = shouldSetCarryFlag(
      Operation.Add,
      BitLength.DoubleByte,
      target,
      source
    );

    return 2 as const;
  }

  private LD_A_HLa_and_DEC_HL() {
    this.LD_R_RRa('a', 'h', 'l');
    this.DEC_HL();

    return 2 as const;
  }

  private DEC_SP() {
    return this.DEC_doubleByteR('sp');
  }

  private INC_A() {
    return this.INC_R('a');
  }

  private DEC_A() {
    return this.DEC_R('a');
  }

  private LD_A_d8() {
    return this.LD_R_d8('a');
  }

  private CCF() {
    this.carryFlag = !this.carryFlag;
    this.substractionFlag = false;
    this.halfCarryFlag = false;

    return 1 as const;
  }

  // ***** [8th 8 ops] [0x38 - 0x3f] ends *****

  // ***** [9th 8 ops] [0x40 - 0x47] starts *****

  private LD_B_B() {
    return this.LD_R_R('b', 'b');
  }

  private LD_B_C() {
    return this.LD_R_R('b', 'c');
  }

  private LD_B_D() {
    return this.LD_R_R('b', 'd');
  }

  private LD_B_E() {
    return this.LD_R_R('b', 'e');
  }

  private LD_B_H() {
    return this.LD_R_R('b', 'h');
  }

  private LD_B_L() {
    return this.LD_R_R('b', 'l');
  }

  private LD_B_HLa() {
    return this.LD_R_RRa('b', 'h', 'l');
  }

  private LD_B_A() {
    return this.LD_R_R('b', 'a');
  }

  // ***** [9th 8 ops] [0x40 - 0x47] ends *****

  // ***** [10th 8 ops] [0x48 - 0x4f] starts *****

  private LD_C_B() {
    return this.LD_R_R('c', 'b');
  }

  private LD_C_C() {
    return this.LD_R_R('c', 'c');
  }

  private LD_C_D() {
    return this.LD_R_R('c', 'd');
  }

  private LD_C_E() {
    return this.LD_R_R('c', 'e');
  }

  private LD_C_H() {
    return this.LD_R_R('c', 'h');
  }

  private LD_C_L() {
    return this.LD_R_R('c', 'l');
  }

  private LD_C_HLa() {
    return this.LD_R_RRa('c', 'h', 'l');
  }

  private LD_C_A() {
    return this.LD_R_R('c', 'a');
  }

  // ***** [10th 8 ops] [0x48 - 0x4f] ends *****

  // ***** [11th 8 ops] [0x50 - 0x57] starts *****

  private LD_D_B() {
    return this.LD_R_R('d', 'b');
  }

  private LD_D_C() {
    return this.LD_R_R('d', 'c');
  }

  private LD_D_D() {
    return this.LD_R_R('d', 'd');
  }

  private LD_D_E() {
    return this.LD_R_R('d', 'e');
  }

  private LD_D_H() {
    return this.LD_R_R('d', 'h');
  }

  private LD_D_L() {
    return this.LD_R_R('d', 'l');
  }

  private LD_D_HLa() {
    return this.LD_R_RRa('d', 'h', 'l');
  }

  private LD_D_A() {
    return this.LD_R_R('d', 'a');
  }

  // ***** [11th 8 ops] [0x50 - 0x57] ends *****

  // ***** [12th 8 ops] [0x58 - 0x5f] starts *****

  private LD_E_B() {
    return this.LD_R_R('e', 'b');
  }

  private LD_E_C() {
    return this.LD_R_R('e', 'c');
  }

  private LD_E_D() {
    return this.LD_R_R('e', 'd');
  }

  private LD_E_E() {
    return this.LD_R_R('e', 'e');
  }

  private LD_E_H() {
    return this.LD_R_R('e', 'h');
  }

  private LD_E_L() {
    return this.LD_R_R('e', 'l');
  }

  private LD_E_HLa() {
    return this.LD_R_RRa('e', 'h', 'l');
  }

  private LD_E_A() {
    return this.LD_R_R('e', 'a');
  }

  // ***** [12th 8 ops] [0x58 - 0x5f] ends *****

  // ***** [13th 8 ops] [0x60 - 0x67] starts *****

  private LD_H_B() {
    return this.LD_R_R('h', 'b');
  }

  private LD_H_C() {
    return this.LD_R_R('h', 'c');
  }

  private LD_H_D() {
    return this.LD_R_R('h', 'd');
  }

  private LD_H_E() {
    return this.LD_R_R('h', 'e');
  }

  private LD_H_H() {
    return this.LD_R_R('h', 'h');
  }

  private LD_H_L() {
    return this.LD_R_R('h', 'l');
  }

  private LD_H_HLa() {
    return this.LD_R_RRa('h', 'h', 'l');
  }

  private LD_H_A() {
    return this.LD_R_R('h', 'a');
  }

  // ***** [13th 8 ops] [0x69 - 0x67] ends *****

  // ***** [14th 8 ops] [0x68 - 0x6f] starts *****

  private LD_L_B() {
    return this.LD_R_R('l', 'b');
  }

  private LD_L_C() {
    return this.LD_R_R('l', 'c');
  }

  private LD_L_D() {
    return this.LD_R_R('l', 'd');
  }

  private LD_L_E() {
    return this.LD_R_R('l', 'e');
  }

  private LD_L_H() {
    return this.LD_R_R('l', 'h');
  }

  private LD_L_L() {
    return this.LD_R_R('l', 'l');
  }

  private LD_L_HLa() {
    return this.LD_R_RRa('l', 'h', 'l');
  }

  private LD_L_A() {
    return this.LD_R_R('l', 'a');
  }

  // ***** [14th 8 ops] [0x68 - 0x6f] ends *****

  // ***** [15th 8 ops] [0x70 - 0x77] starts *****

  private LD_HLa_B() {
    return this.LD_RRa_R('h', 'l', 'b');
  }

  private LD_HLa_C() {
    return this.LD_RRa_R('h', 'l', 'c');
  }

  private LD_HLa_D() {
    return this.LD_RRa_R('h', 'l', 'd');
  }

  private LD_HLa_E() {
    return this.LD_RRa_R('h', 'l', 'e');
  }

  private LD_HLa_H() {
    return this.LD_RRa_R('h', 'l', 'h');
  }

  private LD_HLa_L() {
    return this.LD_RRa_R('h', 'l', 'l');
  }

  private HALT() {
    this.#halted = true;

    return 1 as const;
  }

  private LD_HLa_A() {
    return this.LD_RRa_R('h', 'l', 'a');
  }

  // ***** [15th 8 ops] [0x70 - 0x77] ends *****

  // ***** [16th 8 ops] [0x78 - 0x7f] starts *****

  private LD_A_B() {
    return this.LD_R_R('a', 'b');
  }

  private LD_A_C() {
    return this.LD_R_R('a', 'c');
  }

  private LD_A_D() {
    return this.LD_R_R('a', 'd');
  }

  private LD_A_E() {
    return this.LD_R_R('a', 'e');
  }

  private LD_A_H() {
    return this.LD_R_R('a', 'h');
  }

  private LD_A_L() {
    return this.LD_R_R('a', 'l');
  }

  private LD_A_HLa() {
    return this.LD_R_RRa('a', 'h', 'l');
  }

  private LD_A_A() {
    return this.LD_R_R('a', 'a');
  }

  // ***** [16th 8 ops] [0x78 - 0x7f] ends *****

  // ***** [17th 8 ops] [0x80 - 0x87] starts *****

  private ADD_A_B() {
    return this.ADD_R_R('a', 'b');
  }

  private ADD_A_C() {
    return this.ADD_R_R('a', 'c');
  }

  private ADD_A_D() {
    return this.ADD_R_R('a', 'd');
  }

  private ADD_A_E() {
    return this.ADD_R_R('a', 'e');
  }

  private ADD_A_H() {
    return this.ADD_R_R('a', 'h');
  }

  private ADD_A_L() {
    return this.ADD_R_R('a', 'l');
  }

  private ADD_A_HLa() {
    return this.ADD_R_RRa('a', 'h', 'l');
  }

  private ADD_A_A() {
    return this.ADD_R_R('a', 'a');
  }

  // ***** [17th 8 ops] [0x80 - 0x87] ends *****

  // ***** [18th 8 ops] [0x88 - 0x8f] starts *****

  private ADC_A_B() {
    return this.ADC_R_R('a', 'b');
  }

  private ADC_A_C() {
    return this.ADC_R_R('a', 'c');
  }

  private ADC_A_D() {
    return this.ADC_R_R('a', 'd');
  }

  private ADC_A_E() {
    return this.ADC_R_R('a', 'e');
  }

  private ADC_A_H() {
    return this.ADC_R_R('a', 'h');
  }

  private ADC_A_L() {
    return this.ADC_R_R('a', 'l');
  }

  private ADC_A_HLa() {
    return this.ADC_R_RRa('a', 'h', 'l');
  }

  private ADC_A_A() {
    return this.ADC_R_R('a', 'a');
  }

  // ***** [18th 8 ops] [0x88 - 0x8f] ends *****

  // ***** [19th 8 ops] [0x90 - 0x97] starts *****

  private SUB_A_B() {
    return this.SUB_R_R('a', 'b');
  }

  private SUB_A_C() {
    return this.SUB_R_R('a', 'c');
  }

  private SUB_A_D() {
    return this.SUB_R_R('a', 'd');
  }

  private SUB_A_E() {
    return this.SUB_R_R('a', 'e');
  }

  private SUB_A_H() {
    return this.SUB_R_R('a', 'h');
  }

  private SUB_A_L() {
    return this.SUB_R_R('a', 'l');
  }

  private SUB_A_HLa() {
    return this.SUB_R_RRa('a', 'h', 'l');
  }

  private SUB_A_A() {
    return this.SUB_R_R('a', 'a');
  }

  // ***** [19th 8 ops] [0x90 - 0x97] ends *****

  // ***** [20th 8 ops] [0x98 - 0x9f] starts *****

  private SBC_A_B() {
    return this.SBC_R_R('a', 'b');
  }

  private SBC_A_C() {
    return this.SBC_R_R('a', 'c');
  }

  private SBC_A_D() {
    return this.SBC_R_R('a', 'd');
  }

  private SBC_A_E() {
    return this.SBC_R_R('a', 'e');
  }

  private SBC_A_H() {
    return this.SBC_R_R('a', 'h');
  }

  private SBC_A_L() {
    return this.SBC_R_R('a', 'l');
  }

  private SBC_A_HLa() {
    return this.SBC_R_RRa('a', 'h', 'l');
  }

  private SBC_A_A() {
    return this.SBC_R_R('a', 'a');
  }

  // ***** [20th 8 ops] [0x98 - 0x9f] ends *****

  // ***** [21st 8 ops] [0xa0 - 0xa7] starts *****

  private AND_A_B() {
    return this.AND_R_R('a', 'b');
  }

  private AND_A_C() {
    return this.AND_R_R('a', 'c');
  }

  private AND_A_D() {
    return this.AND_R_R('a', 'd');
  }

  private AND_A_E() {
    return this.AND_R_R('a', 'e');
  }

  private AND_A_H() {
    return this.AND_R_R('a', 'h');
  }

  private AND_A_L() {
    return this.AND_R_R('a', 'l');
  }

  private AND_A_HLa() {
    return this.AND_R_RRa('a', 'h', 'l');
  }

  private AND_A_A() {
    return this.AND_R_R('a', 'a');
  }

  // ***** [21st 8 ops] [0xa0 - 0xa7] ends *****

  // ***** [22nd 8 ops] [0xa8 - 0xaf] starts *****

  private XOR_A_B() {
    return this.XOR_R_R('a', 'b');
  }

  private XOR_A_C() {
    return this.XOR_R_R('a', 'c');
  }

  private XOR_A_D() {
    return this.XOR_R_R('a', 'd');
  }

  private XOR_A_E() {
    return this.XOR_R_R('a', 'e');
  }

  private XOR_A_H() {
    return this.XOR_R_R('a', 'h');
  }

  private XOR_A_L() {
    return this.XOR_R_R('a', 'l');
  }

  private XOR_A_HLa() {
    return this.XOR_R_RRa('a', 'h', 'l');
  }

  private XOR_A_A() {
    return this.XOR_R_R('a', 'a');
  }

  // ***** [22nd 8 ops] [0xa8 - 0xaf] ends *****

  // ***** [23rd 8 ops] [0xb0 - 0xb7] starts *****

  private OR_A_B() {
    return this.OR_R_R('a', 'b');
  }

  private OR_A_C() {
    return this.OR_R_R('a', 'c');
  }

  private OR_A_D() {
    return this.OR_R_R('a', 'd');
  }

  private OR_A_E() {
    return this.OR_R_R('a', 'e');
  }

  private OR_A_H() {
    return this.OR_R_R('a', 'h');
  }

  private OR_A_L() {
    return this.OR_R_R('a', 'l');
  }

  private OR_A_HLa() {
    return this.OR_R_RRa('a', 'h', 'l');
  }

  private OR_A_A() {
    return this.OR_R_R('a', 'a');
  }

  // ***** [23rd 8 ops] [0xb0 - 0xb7] ends *****

  // ***** [24th 8 ops] [0xb8 - 0xbf] starts *****

  private CP_A_B() {
    return this.CP_R_R('a', 'b');
  }

  private CP_A_C() {
    return this.CP_R_R('a', 'c');
  }

  private CP_A_D() {
    return this.CP_R_R('a', 'd');
  }

  private CP_A_E() {
    return this.CP_R_R('a', 'e');
  }

  private CP_A_H() {
    return this.CP_R_R('a', 'h');
  }

  private CP_A_L() {
    return this.CP_R_R('a', 'l');
  }

  private CP_A_HLa() {
    return this.CP_R_RRa('a', 'h', 'l');
  }

  private CP_A_A() {
    return this.CP_R_R('a', 'a');
  }

  // ***** [24th 8 ops] [0xb8 - 0xbf] ends *****

  // ***** [25th 8 ops] [0xc0 - 0xc7] starts *****

  private RET_NZ() {
    if (this.zeroFlag) {
      // not return
      return 2 as const;
    } else {
      // return
      this.RET();
      return 5 as const;
    }
  }

  private POP_BC() {
    return this.POP_RR('b', 'c');
  }

  private JP_NZ_d16a() {
    if (this.zeroFlag) {
      // no jump
      this.pcInc();
      this.pcInc();
      return 3 as const;
    } else {
      // jump
      return this.JP_d16a();
    }
  }

  private JP_d16a() {
    const addrLowerByte = this.readFromPcAndIncPc();
    const addrHigherByte = this.readFromPcAndIncPc();
    const addr = this.joinTwoByte(addrHigherByte, addrLowerByte);

    this.#registers.pc = addr;
    return 4 as const;
  }

  private CALL_NZ_d16a() {
    if (this.zeroFlag) {
      // no call
      this.pcInc();
      this.pcInc();

      return 3 as const;
    } else {
      // call
      return this.CALL_d16a();
    }
  }

  private PUSH_BC() {
    return this.PUSH_RR('b', 'c');
  }

  private ADD_A_d8() {
    return this.ADD_R_d8('a');
  }

  private RST_0() {
    return this.RST_n(0);
  }

  // ***** [25th 8 ops] [0xc0 - 0xc7] ends *****

  // ***** [26th 8 ops] [0xc8 - 0xcf] starts *****

  private RET_Z() {
    if (this.zeroFlag) {
      // return
      this.RET();

      return 5 as const;
    } else {
      // no return

      return 2 as const;
    }
  }

  private RET() {
    const lowerByte = this.readFromSpAndIncSp();
    const higherByte = this.readFromSpAndIncSp();
    this.#registers.pc = this.joinTwoByte(higherByte, lowerByte);

    return 4 as const;
  }

  private JP_Z_d16a() {
    if (this.zeroFlag) {
      // jump
      return this.JP_d16a();
    } else {
      // nojump
      this.pcInc();
      this.pcInc();

      return 3 as const;
    }
  }

  private CALL_OP_WITH_CB_PREFIX() {
    const opcode = this.readFromPcAndIncPc();
    const func = this.#opMapCBPrefixed[opcode];
    return func.call(this);
  }

  private CALL_Z_d16_a() {
    if (this.zeroFlag) {
      // call
      return this.CALL_d16a();
    } else {
      // no call
      this.pcInc();
      this.pcInc();

      return 3 as const;
    }
  }

  private CALL_d16a() {
    const addrLowerByte = this.readFromPcAndIncPc();
    const addrHigherByte = this.readFromPcAndIncPc();
    const callAddr = this.joinTwoByte(addrHigherByte, addrLowerByte);

    this.DEC_doubleByteR('sp');
    this.#memory.writeByte(
      this.#registers.sp,
      higherByteOfDoubleByte(this.#registers.pc)
    );
    this.DEC_doubleByteR('sp');
    this.#memory.writeByte(
      this.#registers.sp,
      lowerByteOfDoubleByte(this.#registers.pc)
    );

    this.#registers.pc = callAddr;

    return 6 as const;
  }

  private ADC_A_d8() {
    return this.ADC_R_d8('a');
  }

  private RST_1() {
    return this.RST_n(1);
  }

  // ***** [26th 8 ops] [0xc8 - 0xcf] ends *****

  // ***** [27th 8 ops] [0xd0 - 0xd7] starts *****

  private RET_NC() {
    if (this.carryFlag) {
      // no return

      return 2 as const;
    } else {
      // return
      this.RET();

      return 5 as const;
    }
  }

  private POP_DE() {
    return this.POP_RR('d', 'e');
  }

  private JP_NC_d16a() {
    if (this.carryFlag) {
      // no jump
      this.pcInc();
      this.pcInc();

      return 3 as const;
    } else {
      // jump
      return this.JP_d16a();
    }
  }

  // empty op

  private CALL_NC_d16a() {
    if (this.carryFlag) {
      // no call
      this.pcInc();
      this.pcInc();

      return 3 as const;
    } else {
      // call
      return this.CALL_d16a();
    }
  }

  private PUSH_DE() {
    return this.PUSH_RR('d', 'e');
  }

  private SUB_A_d8() {
    return this.SUB_R_d8('a');
  }

  private RST_2() {
    return this.RST_n(2);
  }

  // ***** [27th 8 ops] [0xd0 - 0xd7] ends *****

  // ***** [28th 8 ops] [0xd8 - 0xdf] starts *****

  private RET_C() {
    if (this.carryFlag) {
      // ret
      this.RET();

      return 5 as const;
    } else {
      // no ret

      return 2 as const;
    }
  }

  private RETI() {
    this.EI();
    return this.RET();
  }

  private JP_C_d16a() {
    if (this.carryFlag) {
      // jump
      return this.JP_d16a();
    } else {
      // no jump
      this.pcInc();
      this.pcInc();

      return 3 as const;
    }
  }

  // empty opcode

  private CALL_C_d16a() {
    if (!this.carryFlag) {
      // no call
      this.pcInc();
      this.pcInc();

      return 3 as const;
    } else {
      // call
      return this.CALL_d16a();
    }
  }

  // empty opcode

  private SBC_A_d8() {
    return this.SBC_R_d8('a');
  }

  private RST_3() {
    return this.RST_n(3);
  }

  // ***** [28th 8 ops] [0xd8 - 0xdf] ends *****

  // ***** [29th 8 ops] [0xe0 - 0xe7] starts *****

  private LD_d8a_A() {
    return this.LD_d8a_R('a');
  }

  private POP_HL() {
    return this.POP_RR('h', 'l');
  }

  private LD_Ca_A() {
    return this.LD_Ra_R('c', 'a');
  }

  // empty opcode

  // empty opcode

  private PUSH_HL() {
    return this.PUSH_RR('h', 'l');
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

    return 2 as const;
  }

  private RST_4() {
    return this.RST_n(4);
  }

  // ***** [29th 8 ops] [0xe0 - 0xe7] ends *****

  // ***** [30th 8 ops] [0xe8 - 0xef] starts *****

  private ADD_SP_s8() {
    const notExtended = this.readFromPcAndIncPc();
    const extended = signedExtend(
      notExtended,
      BitLength.OneByte,
      BitLength.DoubleByte
    );
    const sp = this.#registers.sp;
    const result = addWithDoubleByte(sp, extended);
    this.#registers.sp = result;
    this.zeroFlag = false;
    this.substractionFlag = false;
    // yeah one byte is correct
    this.halfCarryFlag = shouldSetHalfCarryFlag(
      Operation.Add,
      BitLength.OneByte,
      sp,
      extended
    );
    this.carryFlag = shouldSetCarryFlag(
      Operation.Add,
      BitLength.OneByte,
      sp,
      extended
    );

    return 4 as const;
  }

  private JP_HL() {
    const addr = this.joinRegisterPair('h', 'l');
    this.#registers.pc = addr;

    return 1 as const;
  }

  private LD_d16a_A() {
    return this.LD_d16a_R('a');
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

    return 2 as const;
  }

  private RST_5() {
    return this.RST_n(5);
  }

  // ***** [30th 8 ops] [0xe8 - 0xef] ends *****

  // ***** [31st 8 ops] [0xf0 - 0xf7] starts *****

  private LD_A_d8a() {
    return this.LD_R_d8a('a');
  }

  private POP_AF() {
    const lowerByte = this.readFromSpAndIncSp();
    this.#registers.f = lowerByte & 0xf0;
    this.#registers.a = this.readFromSpAndIncSp();

    return 3 as const;
  }

  private LD_A_Ca() {
    return this.LD_R_Ra('a', 'c');
  }

  private DI() {
    this.#IME = false;

    return 1 as const;
  }

  // empty op

  private PUSH_AF() {
    return this.PUSH_RR('a', 'f');
  }

  private OR_d8() {
    const d8 = this.readFromPcAndIncPc();
    const result = orWithOneByte(d8, this.#registers.a);
    this.zeroFlag = shouldSetZeroFlag(result);
    this.substractionFlag = false;
    this.halfCarryFlag = false;
    this.carryFlag = false;

    this.#registers.a = result;

    return 2 as const;
  }

  private RST_6() {
    return this.RST_n(6);
  }

  // ***** [31st 8 ops] [0xf0 - 0xf7] ends *****

  // ***** [32nd 8 ops] [0xf8 - 0xff] starts *****

  private LD_HL_SPPlusD8() {
    const notExtended = this.readFromPcAndIncPc();
    const extended = signedExtend(
      notExtended,
      BitLength.OneByte,
      BitLength.DoubleByte
    );
    const originSp = this.#registers.sp;
    const sp = addWithDoubleByte(originSp, extended);
    this.distributeToRegisterPair('h', 'l', sp);

    this.zeroFlag = false;
    this.substractionFlag = false;
    this.halfCarryFlag = shouldSetHalfCarryFlag(
      Operation.Add,
      BitLength.OneByte,
      originSp,
      extended
    );
    this.carryFlag = shouldSetCarryFlag(
      Operation.Add,
      BitLength.OneByte,
      originSp,
      extended
    );

    return 3 as const;
  }

  private LD_SP_HL() {
    const result = this.joinRegisterPair('h', 'l');
    this.#registers.sp = result;

    return 2 as const;
  }

  private LD_A_d16a() {
    return this.LD_R_d16a('a');
  }

  private EI() {
    this.#IME = true;
    this.#EI_DELAY = true;

    return 1 as const;
  }

  // empty op

  // empty op

  private CP_d8() {
    const d8 = this.readFromPcAndIncPc();
    const a = this.#registers.a;
    const result = minusWithOneByte(a, d8);

    this.zeroFlag = shouldSetZeroFlag(result);
    this.substractionFlag = true;
    this.halfCarryFlag = shouldSetHalfCarryFlag(
      Operation.Minus,
      BitLength.OneByte,
      a,
      d8
    );
    this.carryFlag = shouldSetCarryFlag(
      Operation.Minus,
      BitLength.OneByte,
      a,
      d8
    );

    return 2 as const;
  }

  private RST_7() {
    return this.RST_n(7);
  }

  // ***** [32nd 8 ops] [0xf8 - 0xff] ends *****

  // ***** CB prefixed op set starts *****

  // ***** [1st 8 ops] [0x00 - 0x07] starts *****

  private RLC_B() {
    return this.RLC_R('b');
  }

  private RLC_C() {
    return this.RLC_R('c');
  }

  private RLC_D() {
    return this.RLC_R('d');
  }

  private RLC_E() {
    return this.RLC_R('e');
  }

  private RLC_H() {
    return this.RLC_R('h');
  }

  private RLC_L() {
    return this.RLC_R('l');
  }

  private RLC_HLa() {
    return this.RLC_RRa('h', 'l');
  }

  private RLC_A() {
    return this.RLC_R('a');
  }

  // ***** [1st 8 ops] [0x00 - 0x07] ends *****

  // ***** [2nd 8 ops] [0x08 - 0x0f] starts *****

  private RRC_B() {
    return this.RRC_R('b');
  }

  private RRC_C() {
    return this.RRC_R('c');
  }

  private RRC_D() {
    return this.RRC_R('d');
  }

  private RRC_E() {
    return this.RRC_R('e');
  }

  private RRC_H() {
    return this.RRC_R('h');
  }

  private RRC_L() {
    return this.RRC_R('l');
  }

  private RRC_HLa() {
    return this.RRC_RRa('h', 'l');
  }

  private RRC_A() {
    return this.RRC_R('a');
  }

  // ***** [2nd 8 ops] [0x08 - 0x0f] ends *****

  // ***** [3rd 8 ops] [0x10 - 0x17] starts *****

  private RL_B() {
    return this.RL_R('b');
  }

  private RL_C() {
    return this.RL_R('c');
  }

  private RL_D() {
    return this.RL_R('d');
  }

  private RL_E() {
    return this.RL_R('e');
  }

  private RL_H() {
    return this.RL_R('h');
  }

  private RL_L() {
    return this.RL_R('l');
  }

  private RL_HLa() {
    return this.RL_RRa('h', 'l');
  }

  private RL_A() {
    return this.RL_R('a');
  }

  // ***** [3rd 8 ops] [0x10 - 0x17] ends *****

  // ***** [4th 8 ops] [0x18 - 0x1f] starts *****

  private RR_B() {
    return this.RR_R('b');
  }

  private RR_C() {
    return this.RR_R('c');
  }

  private RR_D() {
    return this.RR_R('d');
  }

  private RR_E() {
    return this.RR_R('e');
  }

  private RR_H() {
    return this.RR_R('h');
  }

  private RR_L() {
    return this.RR_R('l');
  }

  private RR_HLa() {
    return this.RR_RRa('h', 'l');
  }

  private RR_A() {
    return this.RR_R('a');
  }

  // ***** [4th 8 ops] [0x18 - 0x1f] ends *****

  // ***** [5th 8 ops] [0x20 - 0x27] starts *****

  private SLA_B() {
    return this.SLA_R('b');
  }

  private SLA_C() {
    return this.SLA_R('c');
  }

  private SLA_D() {
    return this.SLA_R('d');
  }

  private SLA_E() {
    return this.SLA_R('e');
  }

  private SLA_H() {
    return this.SLA_R('h');
  }

  private SLA_L() {
    return this.SLA_R('l');
  }

  private SLA_HLa() {
    return this.SLA_RRa('h', 'l');
  }

  private SLA_A() {
    return this.SLA_R('a');
  }

  // ***** [5th 8 ops] [0x20 - 0x27] ends *****

  // ***** [6th 8 ops] [0x28 - 0x2f] starts *****

  private SRA_B() {
    return this.SRA_R('b');
  }

  private SRA_C() {
    return this.SRA_R('c');
  }

  private SRA_D() {
    return this.SRA_R('d');
  }

  private SRA_E() {
    return this.SRA_R('e');
  }

  private SRA_H() {
    return this.SRA_R('h');
  }

  private SRA_L() {
    return this.SRA_R('l');
  }

  private SRA_HLa() {
    return this.SRA_RRa('h', 'l');
  }

  private SRA_A() {
    return this.SRA_R('a');
  }

  // ***** [6th 8 ops] [0x28 - 0x2f] ends *****

  // ***** [7th 8 ops] [0x30 - 0x37] starts *****

  private SWAP_B() {
    return this.SWAP_R('b');
  }

  private SWAP_C() {
    return this.SWAP_R('c');
  }

  private SWAP_D() {
    return this.SWAP_R('d');
  }

  private SWAP_E() {
    return this.SWAP_R('e');
  }

  private SWAP_H() {
    return this.SWAP_R('h');
  }

  private SWAP_L() {
    return this.SWAP_R('l');
  }

  private SWAP_HLa() {
    return this.SWAP_RRa('h', 'l');
  }

  private SWAP_A() {
    return this.SWAP_R('a');
  }

  // ***** [7th 8 ops] [0x30 - 0x37] ends *****

  // ***** [8th 8 ops] [0x38 - 0x3f] starts *****

  private SRL_B() {
    return this.SRL_R('b');
  }

  private SRL_C() {
    return this.SRL_R('c');
  }

  private SRL_D() {
    return this.SRL_R('d');
  }

  private SRL_E() {
    return this.SRL_R('e');
  }

  private SRL_H() {
    return this.SRL_R('h');
  }

  private SRL_L() {
    return this.SRL_R('l');
  }

  private SRL_HLa() {
    return this.SRL_RRa('h', 'l');
  }

  private SRL_A() {
    return this.SRL_R('a');
  }

  // ***** [8th 8 ops] [0x38 - 0x3f] ends *****

  // ***** [9th 8 ops] [0x40 - 0x47] starts *****

  private BIT_0_B() {
    return this.BIT_n_R(0, 'b');
  }

  private BIT_0_C() {
    return this.BIT_n_R(0, 'c');
  }

  private BIT_0_D() {
    return this.BIT_n_R(0, 'd');
  }

  private BIT_0_E() {
    return this.BIT_n_R(0, 'e');
  }

  private BIT_0_H() {
    return this.BIT_n_R(0, 'h');
  }

  private BIT_0_L() {
    return this.BIT_n_R(0, 'l');
  }

  private BIT_0_HLa() {
    return this.BIT_n_RRa(0, 'h', 'l');
  }

  private BIT_0_A() {
    return this.BIT_n_R(0, 'a');
  }

  // ***** [9th 8 ops] [0x40 - 0x47] ends *****

  // ***** [10th 8 ops] [0x48 - 0x4f] ends *****

  private BIT_1_B() {
    return this.BIT_n_R(1, 'b');
  }

  private BIT_1_C() {
    return this.BIT_n_R(1, 'c');
  }

  private BIT_1_D() {
    return this.BIT_n_R(1, 'd');
  }

  private BIT_1_E() {
    return this.BIT_n_R(1, 'e');
  }

  private BIT_1_H() {
    return this.BIT_n_R(1, 'h');
  }

  private BIT_1_L() {
    return this.BIT_n_R(1, 'l');
  }

  private BIT_1_HLa() {
    return this.BIT_n_RRa(1, 'h', 'l');
  }

  private BIT_1_A() {
    return this.BIT_n_R(1, 'a');
  }

  // ***** [10th 8 ops] [0x48 - 0x4f] ends *****

  // ***** [11th 8 ops] [0x50 - 0x57] starts *****

  private BIT_2_B() {
    return this.BIT_n_R(2, 'b');
  }

  private BIT_2_C() {
    return this.BIT_n_R(2, 'c');
  }

  private BIT_2_D() {
    return this.BIT_n_R(2, 'd');
  }

  private BIT_2_E() {
    return this.BIT_n_R(2, 'e');
  }

  private BIT_2_H() {
    return this.BIT_n_R(2, 'h');
  }

  private BIT_2_L() {
    return this.BIT_n_R(2, 'l');
  }

  private BIT_2_HLa() {
    return this.BIT_n_RRa(2, 'h', 'l');
  }

  private BIT_2_A() {
    return this.BIT_n_R(2, 'a');
  }

  // ***** [11th 8 ops] [0x50 - 0x57] ends *****

  // ***** [12th 8 ops] [0x58 - 0x5f] starts *****

  private BIT_3_B() {
    return this.BIT_n_R(3, 'b');
  }

  private BIT_3_C() {
    return this.BIT_n_R(3, 'c');
  }

  private BIT_3_D() {
    return this.BIT_n_R(3, 'd');
  }

  private BIT_3_E() {
    return this.BIT_n_R(3, 'e');
  }

  private BIT_3_H() {
    return this.BIT_n_R(3, 'h');
  }

  private BIT_3_L() {
    return this.BIT_n_R(3, 'l');
  }

  private BIT_3_HLa() {
    return this.BIT_n_RRa(3, 'h', 'l');
  }

  private BIT_3_A() {
    return this.BIT_n_R(3, 'a');
  }

  // ***** [12th 8 ops] [0x58 - 0x5f] ends *****

  // ***** [13th 8 ops] [0x60 - 0x67] starts *****

  private BIT_4_B() {
    return this.BIT_n_R(4, 'b');
  }

  private BIT_4_C() {
    return this.BIT_n_R(4, 'c');
  }

  private BIT_4_D() {
    return this.BIT_n_R(4, 'd');
  }

  private BIT_4_E() {
    return this.BIT_n_R(4, 'e');
  }

  private BIT_4_H() {
    return this.BIT_n_R(4, 'h');
  }

  private BIT_4_L() {
    return this.BIT_n_R(4, 'l');
  }

  private BIT_4_HLa() {
    return this.BIT_n_RRa(4, 'h', 'l');
  }

  private BIT_4_A() {
    return this.BIT_n_R(4, 'a');
  }

  // ***** [13th 8 ops] [0x60 - 0x67] ends *****

  // ***** [14th 8 ops] [0x68 - 0x6f] starts *****

  private BIT_5_B() {
    return this.BIT_n_R(5, 'b');
  }

  private BIT_5_C() {
    return this.BIT_n_R(5, 'c');
  }

  private BIT_5_D() {
    return this.BIT_n_R(5, 'd');
  }

  private BIT_5_E() {
    return this.BIT_n_R(5, 'e');
  }

  private BIT_5_H() {
    return this.BIT_n_R(5, 'h');
  }

  private BIT_5_L() {
    return this.BIT_n_R(5, 'l');
  }

  private BIT_5_HLa() {
    return this.BIT_n_RRa(5, 'h', 'l');
  }

  private BIT_5_A() {
    return this.BIT_n_R(5, 'a');
  }

  // ***** [14th 8 ops] [0x68 - 0x6f] ends *****

  // ***** [15th 8 ops] [0x70 - 0x77] starts *****

  private BIT_6_B() {
    return this.BIT_n_R(6, 'b');
  }

  private BIT_6_C() {
    return this.BIT_n_R(6, 'c');
  }

  private BIT_6_D() {
    return this.BIT_n_R(6, 'd');
  }

  private BIT_6_E() {
    return this.BIT_n_R(6, 'e');
  }

  private BIT_6_H() {
    return this.BIT_n_R(6, 'h');
  }

  private BIT_6_L() {
    return this.BIT_n_R(6, 'l');
  }

  private BIT_6_HLa() {
    return this.BIT_n_RRa(6, 'h', 'l');
  }

  private BIT_6_A() {
    return this.BIT_n_R(6, 'a');
  }

  // ***** [15th 8 ops] [0x70 - 0x77] ends *****

  // ***** [16th 8 ops] [0x78 - 0x7f] starts *****

  private BIT_7_B() {
    return this.BIT_n_R(7, 'b');
  }

  private BIT_7_C() {
    return this.BIT_n_R(7, 'c');
  }

  private BIT_7_D() {
    return this.BIT_n_R(7, 'd');
  }

  private BIT_7_E() {
    return this.BIT_n_R(7, 'e');
  }

  private BIT_7_H() {
    return this.BIT_n_R(7, 'h');
  }

  private BIT_7_L() {
    return this.BIT_n_R(7, 'l');
  }

  private BIT_7_HLa() {
    return this.BIT_n_RRa(7, 'h', 'l');
  }

  private BIT_7_A() {
    return this.BIT_n_R(7, 'a');
  }

  // ***** [16th 8 ops] [0x78 - 0x7f] ends *****

  // ***** [17th 8 ops] [0x80 - 0x87] starts *****

  private RES_0_B() {
    return this.RES_n_R(0, 'b');
  }

  private RES_0_C() {
    return this.RES_n_R(0, 'c');
  }

  private RES_0_D() {
    return this.RES_n_R(0, 'd');
  }

  private RES_0_E() {
    return this.RES_n_R(0, 'e');
  }

  private RES_0_H() {
    return this.RES_n_R(0, 'h');
  }

  private RES_0_L() {
    return this.RES_n_R(0, 'l');
  }

  private RES_0_HLa() {
    return this.RES_n_RRa(0, 'h', 'l');
  }

  private RES_0_A() {
    return this.RES_n_R(0, 'a');
  }

  // ***** [17th 8 ops] [0x80 - 0x87] ends *****

  // ***** [18th 8 ops] [0x88 - 0x8f] starts *****

  private RES_1_B() {
    return this.RES_n_R(1, 'b');
  }

  private RES_1_C() {
    return this.RES_n_R(1, 'c');
  }

  private RES_1_D() {
    return this.RES_n_R(1, 'd');
  }

  private RES_1_E() {
    return this.RES_n_R(1, 'e');
  }

  private RES_1_H() {
    return this.RES_n_R(1, 'h');
  }

  private RES_1_L() {
    return this.RES_n_R(1, 'l');
  }

  private RES_1_HLa() {
    return this.RES_n_RRa(1, 'h', 'l');
  }

  private RES_1_A() {
    return this.RES_n_R(1, 'a');
  }

  // ***** [18th 8 ops] [0x88 - 0x8f] ends *****

  // ***** [19th 8 ops] [0x90 - 0x97] starts *****

  private RES_2_B() {
    return this.RES_n_R(2, 'b');
  }

  private RES_2_C() {
    return this.RES_n_R(2, 'c');
  }

  private RES_2_D() {
    return this.RES_n_R(2, 'd');
  }

  private RES_2_E() {
    return this.RES_n_R(2, 'e');
  }

  private RES_2_H() {
    return this.RES_n_R(2, 'h');
  }

  private RES_2_L() {
    return this.RES_n_R(2, 'l');
  }

  private RES_2_HLa() {
    return this.RES_n_RRa(2, 'h', 'l');
  }

  private RES_2_A() {
    return this.RES_n_R(2, 'a');
  }

  // ***** [19th 8 ops] [0x90 - 0x97] ends *****

  // ***** [20th 8 ops] [0x98 - 0x9f] starts *****

  private RES_3_B() {
    return this.RES_n_R(3, 'b');
  }

  private RES_3_C() {
    return this.RES_n_R(3, 'c');
  }

  private RES_3_D() {
    return this.RES_n_R(3, 'd');
  }

  private RES_3_E() {
    return this.RES_n_R(3, 'e');
  }

  private RES_3_H() {
    return this.RES_n_R(3, 'h');
  }

  private RES_3_L() {
    return this.RES_n_R(3, 'l');
  }

  private RES_3_HLa() {
    return this.RES_n_RRa(3, 'h', 'l');
  }

  private RES_3_A() {
    return this.RES_n_R(3, 'a');
  }

  // ***** [20th 8 ops] [0x98 - 0x9f] ends *****

  // ***** [21th 8 ops] [0xa0 - 0xa7] starts *****

  private RES_4_B() {
    return this.RES_n_R(4, 'b');
  }

  private RES_4_C() {
    return this.RES_n_R(4, 'c');
  }

  private RES_4_D() {
    return this.RES_n_R(4, 'd');
  }

  private RES_4_E() {
    return this.RES_n_R(4, 'e');
  }

  private RES_4_H() {
    return this.RES_n_R(4, 'h');
  }

  private RES_4_L() {
    return this.RES_n_R(4, 'l');
  }

  private RES_4_HLa() {
    return this.RES_n_RRa(4, 'h', 'l');
  }

  private RES_4_A() {
    return this.RES_n_R(4, 'a');
  }

  // ***** [21th 8 ops] [0xa0 - 0xa7] ends *****

  // ***** [22th 8 ops] [0xa8 - 0xaf] starts *****

  private RES_5_B() {
    return this.RES_n_R(5, 'b');
  }

  private RES_5_C() {
    return this.RES_n_R(5, 'c');
  }

  private RES_5_D() {
    return this.RES_n_R(5, 'd');
  }

  private RES_5_E() {
    return this.RES_n_R(5, 'e');
  }

  private RES_5_H() {
    return this.RES_n_R(5, 'h');
  }

  private RES_5_L() {
    return this.RES_n_R(5, 'l');
  }

  private RES_5_HLa() {
    return this.RES_n_RRa(5, 'h', 'l');
  }

  private RES_5_A() {
    return this.RES_n_R(5, 'a');
  }

  // ***** [22th 8 ops] [0xa8 - 0xaf] ends *****

  // ***** [23th 8 ops] [0xb0 - 0xb7] starts *****

  private RES_6_B() {
    return this.RES_n_R(6, 'b');
  }

  private RES_6_C() {
    return this.RES_n_R(6, 'c');
  }

  private RES_6_D() {
    return this.RES_n_R(6, 'd');
  }

  private RES_6_E() {
    return this.RES_n_R(6, 'e');
  }

  private RES_6_H() {
    return this.RES_n_R(6, 'h');
  }

  private RES_6_L() {
    return this.RES_n_R(6, 'l');
  }

  private RES_6_HLa() {
    return this.RES_n_RRa(6, 'h', 'l');
  }

  private RES_6_A() {
    return this.RES_n_R(6, 'a');
  }

  // ***** [23th 8 ops] [0xb0 - 0xb7] ends *****

  // ***** [24th 8 ops] [0xb8 - 0xbf] starts *****

  private RES_7_B() {
    return this.RES_n_R(7, 'b');
  }

  private RES_7_C() {
    return this.RES_n_R(7, 'c');
  }

  private RES_7_D() {
    return this.RES_n_R(7, 'd');
  }

  private RES_7_E() {
    return this.RES_n_R(7, 'e');
  }

  private RES_7_H() {
    return this.RES_n_R(7, 'h');
  }

  private RES_7_L() {
    return this.RES_n_R(7, 'l');
  }

  private RES_7_HLa() {
    return this.RES_n_RRa(7, 'h', 'l');
  }

  private RES_7_A() {
    return this.RES_n_R(7, 'a');
  }

  // ***** [24th 8 ops] [0xb8 - 0xbf] ends *****

  // ***** [25th 8 ops] [0xc7 - 0xc0] starts *****

  private SET_0_B() {
    return this.SET_n_R(0, 'b');
  }

  private SET_0_C() {
    return this.SET_n_R(0, 'c');
  }

  private SET_0_D() {
    return this.SET_n_R(0, 'd');
  }

  private SET_0_E() {
    return this.SET_n_R(0, 'e');
  }

  private SET_0_H() {
    return this.SET_n_R(0, 'h');
  }

  private SET_0_L() {
    return this.SET_n_R(0, 'l');
  }

  private SET_0_HLa() {
    return this.SET_n_RRa(0, 'h', 'l');
  }

  private SET_0_A() {
    return this.SET_n_R(0, 'a');
  }

  // ***** [25th 8 ops] [0xc0 - 0xc0] ends *****

  // ***** [26th 8 ops] [0xcf - 0xc8] starts *****

  private SET_1_B() {
    return this.SET_n_R(1, 'b');
  }

  private SET_1_C() {
    return this.SET_n_R(1, 'c');
  }

  private SET_1_D() {
    return this.SET_n_R(1, 'd');
  }

  private SET_1_E() {
    return this.SET_n_R(1, 'e');
  }

  private SET_1_H() {
    return this.SET_n_R(1, 'h');
  }

  private SET_1_L() {
    return this.SET_n_R(1, 'l');
  }

  private SET_1_HLa() {
    return this.SET_n_RRa(1, 'h', 'l');
  }

  private SET_1_A() {
    return this.SET_n_R(1, 'a');
  }

  // ***** [26th 8 ops] [0xc8 - 0xc8] ends *****

  // ***** [27th 8 ops] [0xd7 - 0xd0] starts *****

  private SET_2_B() {
    return this.SET_n_R(2, 'b');
  }

  private SET_2_C() {
    return this.SET_n_R(2, 'c');
  }

  private SET_2_D() {
    return this.SET_n_R(2, 'd');
  }

  private SET_2_E() {
    return this.SET_n_R(2, 'e');
  }

  private SET_2_H() {
    return this.SET_n_R(2, 'h');
  }

  private SET_2_L() {
    return this.SET_n_R(2, 'l');
  }

  private SET_2_HLa() {
    return this.SET_n_RRa(2, 'h', 'l');
  }

  private SET_2_A() {
    return this.SET_n_R(2, 'a');
  }

  // ***** [27th 8 ops] [0xd0 - 0xd0] ends *****

  // ***** [28th 8 ops] [0xdf - 0xd8] starts *****

  private SET_3_B() {
    return this.SET_n_R(3, 'b');
  }

  private SET_3_C() {
    return this.SET_n_R(3, 'c');
  }

  private SET_3_D() {
    return this.SET_n_R(3, 'd');
  }

  private SET_3_E() {
    return this.SET_n_R(3, 'e');
  }

  private SET_3_H() {
    return this.SET_n_R(3, 'h');
  }

  private SET_3_L() {
    return this.SET_n_R(3, 'l');
  }

  private SET_3_HLa() {
    return this.SET_n_RRa(3, 'h', 'l');
  }

  private SET_3_A() {
    return this.SET_n_R(3, 'a');
  }

  // ***** [28th 8 ops] [0xd8 - 0xd8] ends *****

  // ***** [29th 8 ops] [0xe7 - 0xe0] starts *****

  private SET_4_B() {
    return this.SET_n_R(4, 'b');
  }

  private SET_4_C() {
    return this.SET_n_R(4, 'c');
  }

  private SET_4_D() {
    return this.SET_n_R(4, 'd');
  }

  private SET_4_E() {
    return this.SET_n_R(4, 'e');
  }

  private SET_4_H() {
    return this.SET_n_R(4, 'h');
  }

  private SET_4_L() {
    return this.SET_n_R(4, 'l');
  }

  private SET_4_HLa() {
    return this.SET_n_RRa(4, 'h', 'l');
  }

  private SET_4_A() {
    return this.SET_n_R(4, 'a');
  }

  // ***** [29th 8 ops] [0xe0 - 0xe0] ends *****

  // ***** [30th 8 ops] [0xef - 0xe8] starts *****

  private SET_5_B() {
    return this.SET_n_R(5, 'b');
  }

  private SET_5_C() {
    return this.SET_n_R(5, 'c');
  }

  private SET_5_D() {
    return this.SET_n_R(5, 'd');
  }

  private SET_5_E() {
    return this.SET_n_R(5, 'e');
  }

  private SET_5_H() {
    return this.SET_n_R(5, 'h');
  }

  private SET_5_L() {
    return this.SET_n_R(5, 'l');
  }

  private SET_5_HLa() {
    return this.SET_n_RRa(5, 'h', 'l');
  }

  private SET_5_A() {
    return this.SET_n_R(5, 'a');
  }

  // ***** [30th 8 ops] [0xe8 - 0xe8] ends *****

  // ***** [31th 8 ops] [0xf7 - 0xf0] starts *****

  private SET_6_B() {
    return this.SET_n_R(6, 'b');
  }

  private SET_6_C() {
    return this.SET_n_R(6, 'c');
  }

  private SET_6_D() {
    return this.SET_n_R(6, 'd');
  }

  private SET_6_E() {
    return this.SET_n_R(6, 'e');
  }

  private SET_6_H() {
    return this.SET_n_R(6, 'h');
  }

  private SET_6_L() {
    return this.SET_n_R(6, 'l');
  }

  private SET_6_HLa() {
    return this.SET_n_RRa(6, 'h', 'l');
  }

  private SET_6_A() {
    return this.SET_n_R(6, 'a');
  }

  // ***** [31th 8 ops] [0xf0 - 0xf0] ends *****

  // ***** [32th 8 ops] [0xff - 0xf8] starts *****

  private SET_7_B() {
    return this.SET_n_R(7, 'b');
  }

  private SET_7_C() {
    return this.SET_n_R(7, 'c');
  }

  private SET_7_D() {
    return this.SET_n_R(7, 'd');
  }

  private SET_7_E() {
    return this.SET_n_R(7, 'e');
  }

  private SET_7_H() {
    return this.SET_n_R(7, 'h');
  }

  private SET_7_L() {
    return this.SET_n_R(7, 'l');
  }

  private SET_7_HLa() {
    return this.SET_n_RRa(7, 'h', 'l');
  }

  private SET_7_A() {
    return this.SET_n_R(7, 'a');
  }

  // ***** [32th 8 ops] [0xf8 - 0xf8] ends *****
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

export function shouldSetCarryFlag(
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

export abstract class MMU {
  abstract readByte(addr: number): number;
  abstract writeByte(addr: number, val: number): void;
  abstract writeDIV(val: number): void;

  abstract readDoubleByte(addr: number): number;
  abstract writeDoubleByte(addr: number, val: number): void;
}

type Z80SingleByteRegisters = 'a' | 'b' | 'c' | 'd' | 'e' | 'h' | 'l' | 'f';
type Z80DoubleByteRegisters = 'sp' | 'pc';
type Z80Registers = Z80SingleByteRegisters | Z80DoubleByteRegisters;
