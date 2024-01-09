/// <reference lib="dom" />
/// <reference lib="dom.iterable" />

const GAMEBOY_SCREEN_WIDTH = 160;
const GAMEBOY_SCREEN_HEIGHT = 144;
enum GPU_MODE {
  HorizontalBlank = 0,
  VerticalBlank = 1,
  ScanlineAccessOAM = 2,
  ScanlineAccessVRAM = 3,
}

const mode2time = [204, 4560, 80, 172] as const;
const totalTime = mode2time.reduce((a, b) => a + b, 0);

export class GPU {
  #width: number;
  #height: number;
  #canvas: HTMLCanvasElement;
  #ctx: CanvasRenderingContext2D;
  #graphicMemory: Uint8ClampedArray;
  #mode: GPU_MODE = 0;
  #clock = 0;

  constructor(width: number, height: number, canvas?: HTMLCanvasElement) {
    this.#width = width;
    this.#height = height;
    this.#canvas = canvas ?? createCanvas(width, height);
    this.#graphicMemory = new Uint8ClampedArray(4 * width * height);
    this.#graphicMemory.fill(0xff);

    const ctx = this.#canvas.getContext('2d');
    if (ctx) {
      this.#ctx = ctx;
    } else {
      throw new Error('Cannot get canvas ctx');
    }

    this.render();
  }

  render() {
    this.#ctx.putImageData(
      new ImageData(this.#graphicMemory, this.#width, this.#height),
      0,
      0
    );
  }

  step(tClock: number) {
    // todo
    // this.#clock += tClock;
    // const netTime = this.#clock % totalTime;
    // let acccumulatedTime = mode2time[0];
    // let modeIndex = 0;
    // while (netTime >= acccumulatedTime + 1) {
    //   modeIndex++;
    //   acccumulatedTime += mode2time[modeIndex];
    // }
    // this.#mode = modeIndex;
  }

  static create_default_GB_GPU() {
    return new GPU(GAMEBOY_SCREEN_WIDTH, GAMEBOY_SCREEN_HEIGHT);
  }
}

function createCanvas(width: number, height: number) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  return canvas;
}
