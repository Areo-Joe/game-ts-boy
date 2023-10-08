// GB's cpu is a modified Z80, so...
class Z80 {
    #memory: MMU

    constructor(mmu: MMU) {
        this.#memory = mmu;
    }

    #registers = {
        a: 0, b: 0, c: 0, d: 0, e: 0, h: 0, l: 0, // for computation
        f: 0, // flag,
        sp: 0, // stack pointer
        pc: 0, // program counter
    }

    #clock = {
        last: 0, // time to run last instruction
        total: 0 // time total
    }

    #opMap = [
        this.NOP, this.LD_BC_d16, this.LD_BCa_A, this.INC_BC, this.INC_B
    ]

    reset() {
        (["register", "clock"] as Array<keyof this>)
            .forEach(resetKey => {
                Object
                    .keys(this[resetKey] as Record<string, number>)
                    .forEach(key => (this[resetKey] as Record<string, number>)[key] = 0)
            })
    }

    clearFlag() {
        this.#registers.f = 0;
    }

    private readRegisterPair(higherByte: Z80Registers, lowerByte: Z80Registers): number {
        return this.#registers[higherByte] << 8 + this.#registers[lowerByte];
    }

    private writeRegisterPair(higherByte: Z80Registers, lowerByte: Z80Registers, val: number) {
        this.#registers[lowerByte] = val & 0xff;
        this.#registers[higherByte] = (val >> 8) & 0xff;
    }

    private setZeroFlag(bool: boolean) {
        if (bool) {
            this.#registers.f |= 0x80;
        } else {
            this.#registers.f &= (0xff ^ 0x80);
        }
    }

    private setSubstractionFlag(bool: boolean) {
        if (bool) {
            this.#registers.f |= 0x40;
        } else {
            this.#registers.f &= (0xff ^ 0x40);
        }
    }

    private setHalfCarryFlag(bool: boolean) {
        if (bool) {
            this.#registers.f |= 0x20;
        } else {
            this.#registers.f &= (0xff ^ 0x20);
        }
    }

    private setCarryFlag(bool: boolean) {
        if (bool) {
            this.#registers.f |= 0x10;
        } else {
            this.#registers.f &= (0xff ^ 0x10);
        }
    }

    private pcInc() {
        this.#registers.pc++;
    }

    private readFromPc() {
        return this.#memory.readByte(this.#registers.pc);
    }

    private NOP() { }

    private LD_BC_d16() {
        let lowerByte = this.readFromPc();
        this.pcInc();
        let higherByte = this.readFromPc();
        this.pcInc();
        this.#registers.b = higherByte;
        this.#registers.c = lowerByte;
    }

    private LD_BCa_A() {
        let addr = this.readRegisterPair("b", "c");
        this.#memory.writeByte(addr, this.#registers.a);
    }

    private INC_BC() {
        let val = this.readRegisterPair("b", "c");
        this.writeRegisterPair("b", "c", (val + 1) & 0xffff);
    }

    private INC_B() {
        let val = this.#registers.b;
        let result = (val + 1) & 0xff;
        this.#registers.b = result;
        this.setZeroFlag(shouldSetZeroFlag(result));
        this.setSubstractionFlag(false);
        this.setHalfCarryFlag((shouldSetHalfCarryFlag(val, 1)));
    }
}

export abstract class MMU {
    abstract readByte(addr: number): number;
    abstract writeByte(addr: number, val: number): void;

    abstract readDoubleByte(addr: number): number;
    abstract writeDoubleByte(addr: number, val: number): void;
}

type Z80Registers = "a" | "b" | "c" | "d" | "e" | "h" | "l" | "f" | "sp" | "pc"

function shouldSetZeroFlag(result: number) {
    return result === 0;
}

function shouldSetHalfCarryFlag(augend: number, addend: number) {
    return (((augend & 0xf) + (addend & 0xf)) & 0x10) !== 0;
}