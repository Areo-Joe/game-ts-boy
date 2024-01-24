async function findFirstDiffLine(a: string, b: string) {
  const [fa, fb] = (
    await Promise.all([Bun.file(a).text(), Bun.file(b).text()])
  ).map((x) => x.split('\n'));
  console.log(fa.length, fb.length);
  for (let i = 0; i < fa.length; i++) {
    if (fa[i] !== fb[i]) {
      console.log(i);
      console.log(fa[i]);
      console.log(fb[i]);
      if (i !== 0) {
        console.log('last');

        console.log(fa[i - 1]);
        console.log(fb[i - 1]);
      }
      break;
    } else {
    }
  }
}

findFirstDiffLine('./logCompare/EpicLog.txt', './logCompare/log.txt');
