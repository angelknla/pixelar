import { fitWithin, IMAGE_QUALITY, shrinkImage } from './image';

afterEach(() => vi.unstubAllGlobals());

describe('browser avatar preparation', () => {
  it('preserves ratio, never enlarges small pictures, and handles extreme dimensions', () => {
    expect(fitWithin(4000, 3000)).toEqual({ width: 512, height: 384 });
    expect(fitWithin(3000, 4000)).toEqual({ width: 384, height: 512 });
    expect(fitWithin(400, 300)).toEqual({ width: 400, height: 300 });
    expect(fitWithin(6000, 10)).toEqual({ width: 512, height: 1 });
  });

  it('uploads a smaller WebP and releases the bitmap', async () => {
    const bitmap = { width: 4000, height: 3000, close: vi.fn() };

    const draw = vi.fn(),
      convert = vi.fn().mockResolvedValue(new Blob(['small'], { type: 'image/webp' }));
    const size = vi.fn();

    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue(bitmap));
    vi.stubGlobal(
      'OffscreenCanvas',
      class {
        constructor(width: number, height: number) {
          size(width, height);
        }
        getContext = () => {
          return { drawImage: draw };
        };
        convertToBlob = convert;
      }
    );

    const file = new File(['x'.repeat(1000)], 'phone.jpg', { type: 'image/jpeg' });
    const result = await shrinkImage(file);

    expect(result.name).toBe('phone.webp');
    expect(result.type).toBe('image/webp');
    expect(result.size).toBeLessThan(file.size);
    expect(size).toHaveBeenCalledWith(512, 384);
    expect(convert).toHaveBeenCalledWith({ type: 'image/webp', quality: IMAGE_QUALITY });
    expect(bitmap.close).toHaveBeenCalled();
  });

  it('keeps the original when decoding fails or re-encoding would be larger', async () => {
    const file = new File(['x'], 'small.png', { type: 'image/png' });

    vi.stubGlobal('createImageBitmap', vi.fn().mockRejectedValue(new Error('Unsupported')));

    expect(await shrinkImage(file)).toBe(file);

    const close = vi.fn();

    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue({ width: 10, height: 10, close }));
    vi.stubGlobal(
      'OffscreenCanvas',
      class {
        getContext = () => {
          return { drawImage: vi.fn() };
        };
        convertToBlob = async () => {
          return new Blob(['larger']);
        };
      }
    );

    expect(await shrinkImage(file)).toBe(file);
    expect(close).toHaveBeenCalled();
  });

  it('falls back to a DOM canvas when OffscreenCanvas is unavailable', async () => {
    vi.stubGlobal('OffscreenCanvas', undefined);
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn().mockResolvedValue({ width: 1000, height: 500, close: vi.fn() })
    );

    const context = vi
      .spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockImplementation(() => ({ drawImage: vi.fn() }) as unknown as CanvasRenderingContext2D);
    const toBlob = vi
      .spyOn(HTMLCanvasElement.prototype, 'toBlob')
      .mockImplementation((callback) => callback(new Blob(['small'], { type: 'image/webp' })));

    try {
      const original = new File(['x'.repeat(100)], 'photo.png', { type: 'image/png' });

      expect((await shrinkImage(original)).type).toBe('image/webp');
      expect(toBlob).toHaveBeenCalled();
    } finally {
      context.mockRestore();
      toBlob.mockRestore();
    }
  });
});
