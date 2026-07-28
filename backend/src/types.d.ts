declare var process: {
  env: Record<string, string | undefined>;
  [key: string]: unknown;
};

declare class Buffer {
  static from(data: ArrayBufferLike): Buffer;
  toString(): string;
}
