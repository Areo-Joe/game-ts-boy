///<reference lib="dom" />

import { CPU } from '../../cpu';
import { GPU } from '../../gpu';
import { GameBoyMMU } from '../../mmu';
import { Timer } from '../../timer';

const mmu = new GameBoyMMU();
const timer = new Timer();
const gpu = new GPU();
timer.setHooks(mmu.timerHooks);
mmu.setTimer(timer);
gpu.setMMU(mmu);
gpu.setGraphicDataHandler((g) => {
  postMessage(g);
});
const cpu = new CPU(mmu, timer, gpu);

onmessage = (e) => {
  const buffer = e.data.buffer as ArrayBuffer;
  mmu.loadRom(new Uint8Array(buffer));

  cpu.run();
};
