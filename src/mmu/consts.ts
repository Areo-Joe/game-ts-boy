enum MemoryDivision {
  fixedCartROM,
  switchableCartROM,
  videoRAM,
  cartRAM,
  workRAM,
  mirrorRAM,
  objectAttributeMemory,
  UNUSABLE_MEMORY,
  IO,
  highRAM,
  IE,
}

const memoryDivisionSizeMap = new Map<MemoryDivision, number>();

memoryDivisionSizeMap.set(MemoryDivision.fixedCartROM, 0x4000);
memoryDivisionSizeMap.set(MemoryDivision.switchableCartROM, 0x4000);
memoryDivisionSizeMap.set(MemoryDivision.videoRAM, 0x2000);
memoryDivisionSizeMap.set(MemoryDivision.cartRAM, 0x2000);
memoryDivisionSizeMap.set(MemoryDivision.workRAM, 0x2000);
memoryDivisionSizeMap.set(MemoryDivision.mirrorRAM, 0x1e00);
memoryDivisionSizeMap.set(MemoryDivision.objectAttributeMemory, 0xa0);
memoryDivisionSizeMap.set(MemoryDivision.UNUSABLE_MEMORY, 0x60);
memoryDivisionSizeMap.set(MemoryDivision.IO, 0x80);
memoryDivisionSizeMap.set(MemoryDivision.highRAM, 0x7f);
memoryDivisionSizeMap.set(MemoryDivision.IE, 1);

const memoryDivisions = [
  MemoryDivision.fixedCartROM,
  MemoryDivision.switchableCartROM,
  MemoryDivision.videoRAM,
  MemoryDivision.cartRAM,
  MemoryDivision.workRAM,
  MemoryDivision.mirrorRAM,
  MemoryDivision.objectAttributeMemory,
  MemoryDivision.UNUSABLE_MEMORY,
  MemoryDivision.IO,
  MemoryDivision.highRAM,
  MemoryDivision.IE,
] as const;

export { MemoryDivision, memoryDivisionSizeMap, memoryDivisions };
