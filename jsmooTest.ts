import { Z80 } from './src/cpu';
import { GPU } from './src/gpu';
import { GameBoyMMU } from './src/mmu';
import { GBTimerImpl } from './src/timer';

export type CPURegisterState = {
  pc: number;
  sp: number;
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
  h: number;
  l: number;
  ram: Array<[number, number]>;
};

export type CPUState = CPURegisterState & {
  ram: Array<[number, number]>;
};

type Test = {
  name: string;
  initial: CPUState;
  final: CPUState;
};

const jsons = Array.from({ length: 0xff }, (_, index) => {
  let str = index.toString(16);
  str =
    Array(2 - str.length)
      .fill(0)
      .join('') +
    str +
    '.json';
  return str;
});

async function getTests(path: string): Promise<Test[]> {
  const file = Bun.file(path);
  const ret = (await file.json()) as Test[];
  return ret;
}

const mmu = new GameBoyMMU();
const gpu = new GPU(160, 144);
const timer = new GBTimerImpl(0, 0);

const cpu = new Z80(mmu, timer, gpu);

for (let i = 0; i < 0xff; i++) {
  if (
    [
      0xcb, 0xd3, 0xdb, 0xdd, 0xe3, 0xe4, 0xeb, 0xec, 0xed, 0xf4, 0xfc, 0xfd,
    ].includes(i)
  ) {
    // Some opcodes are emtpy and we should skip.
    continue;
  }
  const tests = await getTests('./v1/' + jsons[i]);
  let shouldStop = false;
  for (let j = 0; j < tests.length; j++) {
    const test = tests[j];
    cpu.setState(test.initial);
    const time = cpu.runOnce();
    if (typeof time !== 'number') {
      throw new Error(`time is not number ${time}, ${i.toString(16)}`);
    }
    const result = cpu.compareState(test.final);
    if (result !== true) {
      console.log('wrong at:', i.toString(16));
      console.log(test, result);
      shouldStop = true;
      break;
    }
  }
  if (shouldStop) {
    break;
  }
}

// Again with the CB prefixed opcode.
for (let i = 0; i < 0xff; i++) {
  const tests = await getTests('./v1/cb ' + jsons[i]);
  let shouldStop = false;
  for (let j = 0; j < tests.length; j++) {
    const test = tests[j];
    cpu.setState(test.initial);
    const time = cpu.runOnce();
    if (typeof time !== 'number') {
      throw new Error(`time is not number ${time}, cb${i.toString(16)}`);
    }
    const result = cpu.compareState(test.final);
    if (result !== true) {
      console.log('wrong at: cb', i.toString(16));
      console.log(test, result);
      shouldStop = true;
      break;
    }
  }
  if (shouldStop) {
    break;
  }
}
