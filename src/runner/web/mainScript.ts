import ROM from '../../../rom/opus5.gb';
import { debounce } from '../../utils';

const canvas = document.getElementById('canvas')! as HTMLCanvasElement;
const context = canvas.getContext('2d');
if (!context) {
  throw new Error('no context!');
}

const worker = new Worker('./workerScript.js');

const handleMessage = (e: any) => {
  const clamped = e.data as Uint8ClampedArray;
  const imgData = new ImageData(clamped, 160, 144);
  context.putImageData(imgData, 0, 0);
};
const debouncedHandle = debounce(handleMessage, 300);
worker.onmessage = debouncedHandle;
fetch(ROM)
  .then((res) => res.arrayBuffer())
  .then((buffer) => {
    worker.postMessage({
      buffer,
    });
  });
