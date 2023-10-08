import { MMU } from "./cpu";

export class GameBoyMMU extends MMU {
    // 0x0000 - 0x3fff
    #fixedCartridge = new Uint8Array(0x4000);
    // 0x4000 - 0x7fff
    #switchableCartridge = new Uint8Array(0x4000);
    // 0x8000 - 0x9fff
    #videoRam = new Uint8Array(0x2000);
    // 0xa000 - 0xbfff
    #externalCartridge = new Uint8Array(0x2000);
    // 0xc000 - 0xdfff
    #workRam = new Uint8Array(0x2000);
    // 0xe000 - 0xfdff
    #mirrorRam = new Uint8Array(0x1e00);
    // 0xfe00 - 0xfe9f
    #attributeMemory = new Uint8Array(0xa0);
    // 0xfea0 - 0xfeff is not available
    #UNUSABLE_MEMORY = new Uint8Array(0x60);
    // 0xff00 - 0xff7f
    #IO = new Uint8Array(0x80);
    // 0xff80 - 0xffff
    #zeroPage = new Uint8Array(0x80);

    #memory = [
        this.#fixedCartridge,
        this.#switchableCartridge,
        this.#videoRam,
        this.#externalCartridge,
        this.#workRam,
        this.#mirrorRam,
        this.#attributeMemory,
        this.#UNUSABLE_MEMORY,
        this.#IO,
        this.#zeroPage
    ];

    #rom: ArrayBuffer | null = null

    private transformAddr(addr: number): [number, number] {
        if (addr < 0 || addr >= 0x10000) {
            throw new Error(`Invalid address: 0x${addr.toString(16)}`);
        }

        let i = 0;
        let count = this.#memory[0].length;
        while (addr > count) {
            i++;
            count += this.#memory[i].length;
        }

        if (this.#memory[i] === this.#UNUSABLE_MEMORY) {
            throw new Error(`Invalid attempt to access unusable memory area: 0x${addr.toString(16)}`);
        }

        return [i, addr - (count - this.#memory[i].length)];
    }

    readByte(addr: number): number {
        let [memoryIndex, refinedAddr] = this.transformAddr(addr);

        return this.#memory[memoryIndex][refinedAddr];
    }
    readDoubleByte(addr: number): number {
        return this.readByte(addr) + (this.readByte(addr + 1) << 8);
    }
    writeByte(addr: number, val: number): void {
        let [memoryIndex, refinedAddr] = this.transformAddr(addr);

        this.#memory[memoryIndex][refinedAddr] = val;
    }
    writeDoubleByte(addr: number, val: number): void {
        this.writeByte(addr, val);
        this.writeByte(addr + 1, val >> 8);
    }

    loadRom(romFile: ArrayBuffer) {
        this.#rom = romFile; 
    }
}