enum MemoryRegister {
  SB = 0xff01,
  SC = 0xff02,
  // timer
  DIV = 0xff04,
  TIMA = 0xff05,
  TMA = 0xff06,
  TAC = 0xff07,

  IF = 0xff0f,
  LCDC = 0xff40,
  STAT = 0xff41,
  SCY = 0xff42,
  SCX = 0xff43,
  LY = 0xff44,
  LYC = 0xff45,
  DMA = 0xff46,
  BGP = 0xff47,
  OBP0 = 0xff48,
  OBP1 = 0xff49,
  WY = 0xff4a,
  WX = 0xff4b,
  IE = 0xffff,
}

export { MemoryRegister };
