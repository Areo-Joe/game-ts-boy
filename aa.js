'cdehla'.split('').forEach((x) => {
  console.log(`private ADC_A_${x.toUpperCase()}() {
        this.ADC_R_R('a', '${x}');
      }\n\n`);
});
