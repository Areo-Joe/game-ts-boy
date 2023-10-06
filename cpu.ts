// GB's cpu is a modified Z80, so...
class Z80 {
    memory: MMU

    constructor(mmu: MMU) {
        this.memory = mmu;
    }

    registers: {
        a: 0, b: 0, c: 0, d: 0, e: 0, h: 0, l: 0, // for computation
        f: 0, // flag,
        sp: 0, // stack pointer
    }

    clock: {
        last: 0, // time to run last instruction
        total: 0 // time total
    }

    reset() {
        ["register", "clock"]
            .forEach(resetKey => {
                Object
                    .keys(this[resetKey])
                    .forEach(key => this[resetKey][key] = 0)
            })
    }
}

abstract class MMU {
    abstract readByte(addr: number): number;
    abstract writeByte(addr: number, val: number): void;

    abstract readDoubleByte(addr: number): number;
    abstract writeDoubleByte(addr: number, val: number): void;
}