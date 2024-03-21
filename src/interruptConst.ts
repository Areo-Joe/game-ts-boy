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

export { InterruptBit, PRIORITIZED_INTERRUPT_BITS, INTERRUPT_HANDLER_ADDR_MAP };
