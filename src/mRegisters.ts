enum MemoryRegister {
  SB = 0xff01,
  DIV = 0xff04,
  TIMA = 0xff05,
  TMA = 0xff06,
  TAC = 0xff07,
  IF = 0xff0f,
  LY = 0xff44,
  IE = 0xffff,
}

const availableMemoryRegisterSet = new Set<MemoryRegister>();

availableMemoryRegisterSet.add(MemoryRegister.SB);
availableMemoryRegisterSet.add(MemoryRegister.DIV);
availableMemoryRegisterSet.add(MemoryRegister.TIMA);
availableMemoryRegisterSet.add(MemoryRegister.TMA);
availableMemoryRegisterSet.add(MemoryRegister.TAC);
availableMemoryRegisterSet.add(MemoryRegister.IF);
availableMemoryRegisterSet.add(MemoryRegister.LY);
availableMemoryRegisterSet.add(MemoryRegister.IE);

export { MemoryRegister, availableMemoryRegisterSet };
