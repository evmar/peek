
export function hex(n: number, width = 2): string {
  return n.toString(16).padStart(width, '0');
}
