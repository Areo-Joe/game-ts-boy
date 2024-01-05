/// <reference lib="dom" />
/// <reference lib="dom.iterable" />

const GAMEBOY_SCREEN_WIDTH = 160;
const GAMEBOY_SCREEN_HEIGHT = 144;

export class GPU {
  #width: number;
  #height: number;
  #canvas: HTMLCanvasElement;
  #ctx: CanvasRenderingContext2D;
  #graphicMemory: Uint8ClampedArray;

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
