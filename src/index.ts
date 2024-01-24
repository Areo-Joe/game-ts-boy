import { MMU, Z80 } from "./cpu";
import { GPU } from "./gpu";
import { GameBoyMMU } from "./mmu";
import { GBTimerImpl } from "./timer";

async function readRom(name: string) {
  const path = `../cpu_instrs/individual/${name}`;
  const buffer = await Bun.file(path).arrayBuffer();
  return buffer;
}

async function runTestRom(cpu: Z80, romFilePath: string) {
  const buffer = readRom(romFilePath);
  mmu.loadRom(await buffer);
  cpu.run();
}

const tests = [
  "01-special.gb",
  "02-interrupts.gb",
  "03-op sp,hl.gb",
  "04-op r,imm.gb",
  "05-op rp.gb",
  "06-ld r,r.gb",
  "07-jr,jp,call,ret,rst.gb",
  "08-misc instrs.gb",
  "09-op r,r.gb",
  "10-bit ops.gb",
  "11-op a,(hl).gb",
];

const mmu = new GameBoyMMU();
const gpu = new GPU(160, 144);
const timer = new GBTimerImpl(0, 0);

const cpu = new Z80(mmu, timer, gpu);

await runTestRom(cpu, tests[0]);
// await runTestRom(cpu, tests[1]);
// await runTestRom(cpu, tests[2]);
// await runTestRom(cpu, tests[3]);
// await runTestRom(cpu, tests[4]);
// await runTestRom(cpu, tests[5]);
// await runTestRom(cpu, tests[6]);
// await runTestRom(cpu, tests[7]);
// await runTestRom(cpu, tests[8]);
// await runTestRom(cpu, tests[9]);
// await runTestRom(cpu, tests[10]);