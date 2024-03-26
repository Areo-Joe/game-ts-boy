import { MemoryRegister } from './mRegisters';
import { GameBoyMMU } from './mmu';
import { BitLength, getBit, parseAsSigned } from './utils';

/*
4 m-clock === 1 dot
mode 2: 80 dot oam scan
mode 3: 172 dot draw pixel
mode 0: 204 dot horizontal blank
mode 1: 4560 dot vertical blank

while (true) {
  mode 2 -> mode 3 -> mode 0 for [0, 143] scanlines
  then 1 mode 1
}

8 * 8 pixels form a tile. 

A TileData has the color information for each pixel it holds.
VRAM is [0x8000, 0x9FFF]
TileData is split into 3 blocks: 
  - [0x8000, 0x87FF]
  - [0x8800, 0x8FFF]
  - [0x9000, 0x97FF]
each block contains bit: 0x800 * 8 = 8 * 16 * 16 * 8
each TileData contains bit: 8 * 8 * 2
each block contains TileData: (8 * 16 * 16 * 8) / (8 * 8 * 2) = 128

There are 3 layers: BG, Window, Object.
BG & Window may take TileData's address as unsigned/signed.
Object's address always unsigned.

So now we have data for rendering.
To render BG/Window/Object, we need to know which TileData is assigned to BG/Window/Object.

*/

enum GPUMode {
  OAMScan = 2,
  DrawPixelRow = 3,
  HorizontalBlank = 0,
  VerticalBlank = 1,
}

const HORIZONTAL_BLANK_DOT = 204;
const OAM_SCAN_DOT = 80;
const DRAW_PIXEL_ROW_DOT = 172;

const SCANLINE_DOT = HORIZONTAL_BLANK_DOT + OAM_SCAN_DOT + DRAW_PIXEL_ROW_DOT;
const VERTICAL_BLANK_DOT = SCANLINE_DOT * 10;
const RENDERING_DOT = SCANLINE_DOT * 144;
const FRAME_DOT = RENDERING_DOT + VERTICAL_BLANK_DOT;

export class GPU {
  #graphicData: Uint8ClampedArray = new Uint8ClampedArray(
    Array.from({ length: 160 * 144 * 4 })
  );
  #internalDot = 0;
  #MMU: GameBoyMMU | null = null;
  graphicDataHandler: ((graphicData: Uint8ClampedArray) => unknown) | null =
    null;

  constructor() {}

  /**
   * Time is spent and this function updates the PPU state accordingly.
   * Mode and scanline may step forward.
   * If any of these happens, it should sync to the MMU, which should be the single source of truth.
   * If mode changed to horizontal blank, graphic data should be updated.
   * If mode changed to vertical blank, graphic data should be pushed to the outer system(to be rendered).
   */
  step(mClock: number) {
    const newDot = (this.#internalDot + mClock * 4) % FRAME_DOT;
    this.#internalDot = newDot;

    const oldMode = this.mode;
    const oldScanline = this.scanline;

    const newMode = this.calculateModeWithDot(newDot);
    const newScanline = this.calculateActiveScanlineWithDot(newDot);

    const modeChanged = oldMode !== newMode;
    const scanlineChanged = oldScanline !== newScanline;

    if (modeChanged) {
      this.mode = newMode;
    }
    if (scanlineChanged) {
      this.scanline = newScanline;
    }

    if (modeChanged) {
      if (newMode === GPUMode.HorizontalBlank) {
        // update graphic data
        this.updateGraphicData();
      } else if (newMode === GPUMode.VerticalBlank) {
        // push graphic data to outer rendering interface
        this.pushGraphicData();
      }
    }
  }

  get mode() {
    const STAT = this.#MMU!.GPUHooks.getSTAT();
    const GPUMode = (getBit(STAT, 1) << 1) + getBit(STAT, 0);
    return GPUMode as GPUMode;
  }

  /**
   * Only provide the latest value in GPU setter, side effects like updating relative STAT bits are done by MMU.
   */
  set mode(val) {
    const oldSTAT = this.#MMU!.GPUHooks.getSTAT();
    this.#MMU!.GPUHooks.setSTAT((oldSTAT & 0b1111_1100) | (val & 0b11));
  }

  get scanline() {
    return this.#MMU!.GPUHooks.getLY();
  }

  /**
   * Only provide the latest value in GPU setter, side effects like updating relative STAT bits are done by MMU.
   */
  set scanline(val) {
    this.#MMU!.GPUHooks.setLY(val);
  }

  get LCDC() {
    return this.#MMU!.GPUHooks.getLCDC();
  }

  get SCX() {
    return this.#MMU!.GPUHooks.getSCX();
  }

  get SCY() {
    return this.#MMU!.GPUHooks.getSCY();
  }

  get BGP() {
    return this.#MMU!.GPUHooks.getBGP();
  }

  get WY() {
    return this.#MMU!.GPUHooks.getWY();
  }

  get WX() {
    return this.#MMU!.GPUHooks.getWX();
  }

  calculateModeWithDot(dot: number) {
    if (dot < RENDERING_DOT) {
      const dotInOneScanline = dot % SCANLINE_DOT;
      if (dotInOneScanline < OAM_SCAN_DOT) {
        return GPUMode.OAMScan;
      } else if (dotInOneScanline < OAM_SCAN_DOT + DRAW_PIXEL_ROW_DOT) {
        return GPUMode.DrawPixelRow;
      } else {
        return GPUMode.HorizontalBlank;
      }
    } else {
      // vBlanking
      return GPUMode.VerticalBlank;
    }
  }

  calculateActiveScanlineWithDot(dot: number) {
    return Math.floor(dot / SCANLINE_DOT);
  }

  setGraphicDataHandler(fn: (graphicData: Uint8ClampedArray) => unknown) {
    this.graphicDataHandler = fn;
  }

  pushGraphicData() {
    this.graphicDataHandler?.(this.#graphicData);
  }

  /**
   * Call this function during horizontal blank.
   * Horizontal blank means a scanline has finished its job, which is scan 1 row of 160 pixels and render them.
   * So this function's job is:
   * 1. Find current scanline
   * 2. For every pixel on this row, find their color and put update it to the graphic data
   */
  updateGraphicData() {
    const currentLine = this.scanline;
    const LCDC = this.LCDC;
    const BWEnabled = getBit(LCDC, 0) === 1; // BG/Window Enabled
    const objectEnabled = getBit(LCDC, 1) === 1;
    const objectSingleTile = getBit(LCDC, 2) === 0;
    const BGTileDataMapStart = getBit(LCDC, 3) === 1 ? 0x9c00 : 0x9800;
    const addressingWithUnsigned = getBit(LCDC, 4) === 1;
    const windowEnabled = getBit(LCDC, 5) === 1;
    const windowTileDataMapStart = getBit(LCDC, 6) === 1 ? 0x9c00 : 0x9800;
    const SCX = this.SCX;
    const SCY = this.SCY;
    const BGP = this.BGP;
    const WY = this.WY;
    const WX = this.WX;
    const renderLineWithSameColor = (color: number[]) => {
      const startIndex = currentLine * 160 * 4;
      for (let offset = 0; offset < 160; offset++) {
        const baseAddr = startIndex + offset * 4;
        for (let i = 0; i < 4; i++) {
          this.#graphicData[baseAddr + i] = color[i];
        }
      }
    };
    const updateBackground = () => {
      if (!BWEnabled) {
        // set the whole line to white
        renderLineWithSameColor(ColorRGBA.white);
        return;
      }
      // render current line of background
      const renderCurrentBGLine = (SCX: number, SCY: number, line: number) => {
        const realY = line + SCY;
        const realX = SCX;
        const tileEntryRow = Math.floor(realY / 8);
        const tileEntryCol = Math.floor(realX / 8);
        const tileEntriesForCurrentLine = [];
        const tileCount = 160 / 8;
        for (let i = 0; i < tileCount; i++) {
          const colOffset = (tileEntryCol + i) % 32;
          tileEntriesForCurrentLine.push(
            this.#MMU!.readByte(
              BGTileDataMapStart + tileEntryRow * 32 + colOffset
            )
          );
        }
        // with tile entries, we need to fetch tile data with corresponding addressing method
        const lineWithinTile = realY % 8;
        tileEntriesForCurrentLine
          .map((entry) => {
            const tileDataStartAddress = getTileDataStartAddress(
              entry,
              addressingWithUnsigned
            );
            return [
              this.#MMU!.readByte(tileDataStartAddress + lineWithinTile * 2),
              this.#MMU!.readByte(
                tileDataStartAddress + lineWithinTile * 2 + 1
              ),
            ] as const;
          })
          .flatMap((tileDataFor8Pixels) => {
            const [firstByte, secondByte] = tileDataFor8Pixels;
            const colorIds = Array.from(
              { length: 8 },
              (_, index) =>
                (getBit(secondByte, 7 - index) << 1) +
                getBit(firstByte, 7 - index)
            );
            return colorIds.map((colorId) => colorId2ColorRGBA(colorId, BGP));
          })
          .forEach((color, index) => {
            // update each 8 pixels' graphic data
            const pixelIndex = line * 160 + index;
            const baseAddr = pixelIndex * 4;
            for (let i = 0; i < 4; i++) {
              this.#graphicData[baseAddr + i] = color[0 + i];
            }
          });
      };
      renderCurrentBGLine(SCX, SCY, currentLine);
    };
    const updateWindow = () => {
      if (!(BWEnabled && windowEnabled)) {
        // set the whole line to white
        renderLineWithSameColor(ColorRGBA.white);
        return;
      }
      const renderCurrentWindowLine = (
        WX: number,
        WY: number,
        line: number
      ) => {
        if (!WXYInRange(WX, WY)) {
          return;
        }
        const windowTopLeftPixelX = WX - 7;
        const windowTopLeftPixelY = WY;
        if (line < windowTopLeftPixelY) {
          return;
        }

        const pixelRowWithinWindowMap = line - windowTopLeftPixelY;
        const windowBoundPixelCols =
          getWindowBoundingPixelCols(windowTopLeftPixelX);

        const [startPixelColWithinWindowMap, endPixelColWithinWindowMap] =
          windowBoundPixelCols;

        const [startPixelColWithinScreen, endPixelColWithinScreen] =
          windowBoundPixelCols.map((x) => x - windowTopLeftPixelX);

        const tileEntryRow = Math.floor(pixelRowWithinWindowMap / 8);
        const [tileEntryStartCol, tileEntryEndCol] = windowBoundPixelCols.map(
          (x) => Math.floor(x / 8)
        );

        const entries = [];
        const baseAddr = windowTileDataMapStart + tileEntryRow * 32;
        for (let col = tileEntryStartCol; col <= tileEntryEndCol; col++) {
          const addr = baseAddr + col;
          const entry = this.#MMU!.readByte(addr);
          entries.push(entry);
        }

        const lineWithinTile = pixelRowWithinWindowMap % 8;
        let colors = entries
          .map((entry) => {
            const tileDataStartAddress = getTileDataStartAddress(
              entry,
              addressingWithUnsigned
            );
            return [
              this.#MMU!.readByte(tileDataStartAddress + lineWithinTile * 2),
              this.#MMU!.readByte(
                tileDataStartAddress + lineWithinTile * 2 + 1
              ),
            ] as const;
          })
          .flatMap((tileDataFor8Pixels) => {
            const [firstByte, secondByte] = tileDataFor8Pixels;
            const colorIds = Array.from(
              { length: 8 },
              (_, index) =>
                (getBit(secondByte, 7 - index) << 1) +
                getBit(firstByte, 7 - index)
            );
            return colorIds.map((colorId) => colorId2ColorRGBA(colorId, BGP));
          });
        const pixelCount =
          endPixelColWithinWindowMap - startPixelColWithinWindowMap + 1;
        const pixelOffset = startPixelColWithinWindowMap % 8;
        colors = colors.slice(pixelOffset, pixelOffset + pixelCount);

        // update colors to corresponding screen pixel
        for (
          let i = startPixelColWithinScreen;
          i <= endPixelColWithinScreen;
          i++
        ) {
          const color = colors.shift()!;
          const pixelIndex = line * 160 + i;
          const baseAddr = pixelIndex * 4;
          for (let j = 0; j < 4; j++) {
            this.#graphicData[baseAddr + j] = color[j];
          }
        }
      };
      renderCurrentWindowLine(WX, WY, currentLine);
    };

    const updateObject = () => {
      /**
       * There are 40 object attributes at [0xfe00 - 0xfe9f].
       * So size of an object attribute is 0xa0 / 40 = 10 * 16 / 40 = 4 bytes.
       * The 4 bytes' function:
       *  0. Y coord
       *  1. X coord
       *  2. Tile index. Depending on LCDC.2 it can address 1/2 tile data.
       *  3. Flag, controls priority, x/y flip, palette
       * 1 scan line can render up to 10 objects.
       * If 2 object's non-transparent pixels are at the same place, compare X then OAM index to decide which is on top.
       * The top pixel can still be hided by BG.
       */
      if (!objectEnabled) {
        return;
      }
      const renderCurrentObjectLine = (line: number) => {
        const renderObjects = [];
        for (let i = 0; i < 40; i++) {
          const baseAddr = 0xfe00 + i * 4;
          const renderObject = new RenderObject(
            ...(Array.from({ length: 4 }, (_, index) =>
              this.#MMU!.readByte(baseAddr + index)
            ) as [number, number, number, number]),
            objectSingleTile
          );
          if (renderObject.onLine(line)) {
            renderObjects.push(renderObject);
            if (renderObjects.length >= 10) {
              break;
            }
          }
        }
        const renderPixels: RenderObject[][] = [];
        const addPixels = (index: number, obj: RenderObject) => {
          if (!renderPixels[index]) {
            renderPixels[index] = [obj];
          } else {
            renderPixels[index].push(obj);
          }
        };
        const xInRange = (x: number) => {
          return 0 <= x && x <= 159;
        };
        const getObjectPixelColorId = (
          obj: RenderObject,
          pixelX: number,
          pixelY: number
        ) => {
          let relativeX = pixelX - obj.boundingBox.left;
          let relativeY = pixelY - obj.boundingBox.top;
          if (obj.XFlip) {
            relativeX = 7 - relativeX;
          }
          if (obj.YFlip) {
            const bottom = obj.isSingleTile ? 7 : 15;
            relativeY = bottom - relativeY;
          }

          let tileIndex;
          const inTileX = relativeX;
          let inTileY;

          if (obj.isSingleTile) {
            inTileY = relativeY;
            tileIndex = obj.tileIndex;
          } else {
            if (relativeY <= 7) {
              inTileY = relativeY;
              tileIndex = obj.tileIndex & 0xfe;
            } else {
              inTileY = relativeY - 8;
              tileIndex = obj.tileIndex | 0x01;
            }
          }

          const tileDataStartAddress = this.#MMU!.readByte(0x8000 + tileIndex);
          const [lineTileDataFirstByte, lineTileDataSecondByte] = [
            this.#MMU!.readByte(tileDataStartAddress + 2 * inTileY),
            this.#MMU!.readByte(tileDataStartAddress + 2 * inTileY + 1),
          ];
          const colorId =
            (getBit(lineTileDataSecondByte, 7 - inTileX) << 1) +
            getBit(lineTileDataFirstByte, 7 - inTileX);

          return colorId;
        };
        renderObjects.forEach((obj) => {
          const { left, right } = obj.boundingBox;
          for (let i = left; i <= right; i++) {
            if (!xInRange(i)) {
              continue;
            }
            addPixels(i, obj);
          }
        });
        renderPixels.forEach((objs, pixelX) => {
          const objWithColorAndIndexes = objs.map((object, index) => ({
            object,
            colorId: getObjectPixelColorId(object, pixelX, line),
            index,
          }));
          objWithColorAndIndexes.sort((a, b) => {
            if (a.colorId === 0) {
              return 1;
            }
            if (b.colorId === 0) {
              return -1;
            }
            if (a.object.boundingBox.left !== b.object.boundingBox.left) {
              return a.object.boundingBox.left - b.object.boundingBox.left;
            } else {
              return a.index - b.index;
            }
          });
          const objectPixelToRender = objWithColorAndIndexes[0];
          if (objectPixelToRender.colorId === 0) {
            return;
          }
          if (objectPixelToRender.object.BOO) {
            return;
          }
          const palette = this.#MMU!.readByte(
            objectPixelToRender.object.paletteAddress
          );
          const color = colorId2ColorRGBA(objectPixelToRender.colorId, palette);
          const pixelIndex = line * 160 + pixelX;
          const baseAddr = pixelIndex * 4;
          for (let i = 0; i < 4; i++) {
            this.#graphicData[baseAddr + i] = color[i];
          }
        });
      };
      renderCurrentObjectLine(currentLine);
    };
    updateBackground();
    updateWindow();
    updateObject();
  }

  setMMU(MMU: GameBoyMMU) {
    this.#MMU = MMU;
  }
}

class RenderObject {
  boundingBox: {
    top: number;
    left: number;
    bottom: number;
    right: number;
  };
  isSingleTile: boolean;
  tileIndex: number;
  BOO: boolean;
  YFlip: boolean;
  XFlip: boolean;
  paletteAddress: MemoryRegister.OBP0 | MemoryRegister.OBP1;

  constructor(
    Y: number,
    X: number,
    tileIndex: number,
    flag: number,
    isSingleTile: boolean
  ) {
    this.isSingleTile = isSingleTile;
    this.tileIndex = tileIndex;
    this.boundingBox = {
      top: Y - 16,
      bottom: Y - 16 + (isSingleTile ? 8 : 16) - 1,
      left: X - 8,
      right: X - 8 + 7,
    };
    this.BOO = getBit(flag, 7) === 1;
    this.YFlip = getBit(flag, 6) === 1;
    this.XFlip = getBit(flag, 5) === 1;
    this.paletteAddress =
      getBit(flag, 4) === 1 ? MemoryRegister.OBP1 : MemoryRegister.OBP0;
  }

  onLine(line: number) {
    const { top, bottom } = this.boundingBox;
    return top <= line && line <= bottom;
  }
}

function getWindowBoundingPixelCols(windowLeftMostPixelX: number) {
  if (windowLeftMostPixelX <= 0) {
    return [-windowLeftMostPixelX, 159 - windowLeftMostPixelX];
  } else {
    return [0, 159 - windowLeftMostPixelX];
  }
}
const ColorRGBA = {
  white: [255, 255, 255, 255],
  lightGray: [211, 211, 211, 255],
  darkGray: [169, 169, 169, 255],
  black: [0, 0, 0, 255],
};
const colors = [
  ColorRGBA.white,
  ColorRGBA.lightGray,
  ColorRGBA.darkGray,
  ColorRGBA.black,
] as const;

function colorId2ColorRGBA(colorId: number, palette: number) {
  const index =
    (getBit(palette, colorId * 2 + 1) << 1) + getBit(palette, colorId * 2);
  return colors[index];
}

/**
 * Turn tile data index into real address depending on addressing mode.
 */
function getTileDataStartAddress(
  entry: number,
  addressingWithUnsigned: boolean
) {
  if (addressingWithUnsigned) {
    return 0x8000 + entry * 16;
  } else {
    const signed = parseAsSigned(entry, BitLength.OneByte);
    return 0x9000 + signed * 16;
  }
}

/**
 * Check if WX and WY are both in valid range.
 */
function WXYInRange(WX: number, WY: number) {
  return WX >= 0 && WX <= 166 && WY >= 0 && WY <= 143;
}
