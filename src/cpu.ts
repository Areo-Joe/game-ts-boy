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
        this.NOP, this.LD_BC_d16
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

    private setZeroFlag() {
        this.#registers.f |= 0x80;
    }

    private setSubstractionFlag() {
        this.#registers.f |= 0x40;
    }

    private setHalfCarryFlag() {
        this.#registers.f |= 0x20;
    }

    private setCarryFlag() {
        this.#registers.f |= 0x10;
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
}

export abstract class MMU {
    abstract readByte(addr: number): number;
    abstract writeByte(addr: number, val: number): void;

    abstract readDoubleByte(addr: number): number;
    abstract writeDoubleByte(addr: number, val: number): void;
}