
export function hex(n: number, width = 2): string {
  return n.toString(16).padStart(width, '0');
}

export function isPrintable(byte: number): boolean {
  return byte >= 0x20 && byte < 0x7F;
}