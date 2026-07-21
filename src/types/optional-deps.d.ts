// Stubs for optional packages (canvas + tesseract.js).
// These are dynamically imported with try/catch; the types are only
// needed to prevent tsc errors when the packages are not installed.

declare module "canvas" {
  export function createCanvas(width: number, height: number): any;
  export function createImageData(width: number, height: number): any;
  const _default: any;
  export default _default;
}

declare module "tesseract.js" {
  export function createWorker(lang: string, oem?: number, config?: any): Promise<any>;
  export function setLogging(logging: boolean): void;
}
