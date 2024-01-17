import cpu from '../cpu.json';

const firstPage = cpu.unprefixed;
const secondPage = cpu.cbprefixed;

function printOps(setIndex: number, inSetIndex: number, count: number = 1) {
  const baseIndex = setIndex * 8 + inSetIndex;
  for (let i = 0; i < count; i++) {
    const index = baseIndex + i;
    const indexStr = `0x${index
      .toString(16)
      .toUpperCase()}` as keyof typeof firstPage;
    const item = firstPage[indexStr];
    console.log(
      [
        indexStr,
        item.mnemonic,
        item.operands,
        'cycle: ' + item.cycles.join('/'),
      ]
        .filter(Boolean)
        .map((x) => JSON.stringify(x, null, 2))
        .join(', ')
    );
  }
}

printOps(30, 7, 1);
