type writeCondition = (content: string) => boolean;

export class Logger {
  #logStr = '';
  #path: string;
  #writeCondition: writeCondition | null = null;
  constructor(path: string, writeCondition?: writeCondition) {
    this.#path = path;
    writeCondition && (this.#writeCondition = writeCondition);
  }

  log(content: string) {
    console.log(content);
    this.#logStr += content + '\n';
    if (Boolean(this.#writeCondition?.(content))) {
      Bun.write(this.#path, this.#logStr);
    }
  }
}
