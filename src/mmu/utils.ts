import {
  MemoryDivision,
  memoryDivisions,
  memoryDivisionSizeMap,
} from './consts';

export function transformAddr(
  addr: number
): [memoryDivision: MemoryDivision, index: number] {
  if (addr < 0 || addr >= 0x10000) {
    throw new Error(`Invalid address: 0x${addr.toString(16)}`);
  }

  let memoryDivisionIndex = 0;
  let accumulatedMemoryUnitCount = memoryDivisions.length;
  while (!isMemoryUnitEnough(accumulatedMemoryUnitCount, addr)) {
    memoryDivisionIndex++;
    accumulatedMemoryUnitCount += memoryDivisionSizeMap.get(
      memoryDivisions[memoryDivisionIndex]
    )!;
  }
  const countExceptCurrentDivision =
    accumulatedMemoryUnitCount -
    memoryDivisionSizeMap.get(memoryDivisions[memoryDivisionIndex])!;
  const offsetInCurrentDivision = addr - countExceptCurrentDivision;

  return [memoryDivisions[memoryDivisionIndex], offsetInCurrentDivision];

  function isMemoryUnitEnough(memoryUnitCount: number, addr: number) {
    return memoryUnitCount >= addr + 1;
  }
}
