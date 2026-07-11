export class ListStore {
  private items = new Set<string>();

  constructor(initial: string[] = []) {
    initial.forEach((i) => this.items.add(i.toLowerCase()));
  }

  add(entry: string): void {
    this.items.add(entry.toLowerCase());
  }

  remove(entry: string): void {
    this.items.delete(entry.toLowerCase());
  }

  has(entry: string): boolean {
    return this.items.has(entry.toLowerCase());
  }

  list(): string[] {
    return [...this.items];
  }
}

export const whitelist = new ListStore();
export const blacklist = new ListStore([
  'spammer@example.com',
]);
