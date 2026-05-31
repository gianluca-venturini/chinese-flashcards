export function applySm2(
  sr: { n: number; ef: number; i: number },
  q: number,
): { n: number; ef: number; i: number } {
  let { n, ef, i } = sr;

  if (q >= 3) {
    if (n === 0) {
      i = 1;
    } else if (n === 1) {
      i = 6;
    } else {
      i = Math.round(i * ef);
    }
    n = n + 1;
  } else {
    n = 0;
    i = 1;
  }

  ef = ef + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
  ef = Math.max(1.3, ef);

  return { n, ef, i };
}
