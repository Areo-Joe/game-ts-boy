const IE_ADDR = 0xffff; // interrupt enable

const IF_ADDR = 0xff0f; // interrupt flag

enum InterruptBit {
  V_BLANK = 0,
  LCD = 1,
  TIMER = 2,
  SERIAL = 3,
  JOYPAD = 4,
}

const PRIORITIZED_INTERRUPT_BITS = [
  InterruptBit.V_BLANK,
  InterruptBit.LCD,
  InterruptBit.TIMER,
  InterruptBit.SERIAL,
  InterruptBit.JOYPAD,
] as const;

const INTERRUPT_HANDLER_ADDR_MAP = new Map<InterruptBit, number>();
INTERRUPT_HANDLER_ADDR_MAP.set(InterruptBit.V_BLANK, 0x40);
INTERRUPT_HANDLER_ADDR_MAP.set(InterruptBit.LCD, 0x48);
INTERRUPT_HANDLER_ADDR_MAP.set(InterruptBit.TIMER, 0x50);
INTERRUPT_HANDLER_ADDR_MAP.set(InterruptBit.SERIAL, 0x58);
INTERRUPT_HANDLER_ADDR_MAP.set(InterruptBit.JOYPAD, 0x60);

const DIV_ADDR = 0xff04;

const TIMA_ADDR = 0xff05;

const TMA_ADDR = 0xff06;

const TAC_ADDR = 0xff06;

export {
  IE_ADDR,
  IF_ADDR,
  InterruptBit,
  PRIORITIZED_INTERRUPT_BITS,
  INTERRUPT_HANDLER_ADDR_MAP,
  DIV_ADDR,
  TIMA_ADDR,
  TMA_ADDR,
  TAC_ADDR,
};
