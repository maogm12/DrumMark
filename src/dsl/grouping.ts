export function inferGrouping(beats: number, beatUnit: number): number[] | null {
  const key = `${beats}/${beatUnit}`;

  switch (key) {
    case "2/4":
    case "2/2":
      return [1, 1];
    case "3/4":
    case "3/8":
      return [1, 1, 1];
    case "4/4":
      return [2, 2];
    case "6/8":
      return [3, 3];
    case "9/8":
      return [3, 3, 3];
    case "12/8":
      return [3, 3, 3, 3];
    default:
      return null;
  }
}
