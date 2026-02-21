import { describe, it, expect } from "vitest";
import { isValidFrameSync, findFirstFrameSync, getID3v2Size } from "@/lib/elevenlabs";

// Helper: build a valid MP3 frame header at given position
// MPEG1, Layer 3, 128kbps, 44100Hz, stereo
function makeFrameHeader(): Uint8Array {
  return new Uint8Array([0xff, 0xfb, 0x90, 0x00]);
}

// Helper: build an ID3v2 tag of given body size
function makeID3v2Tag(bodySize: number): Uint8Array {
  // "ID3" + version (2.4) + flags + syncsafe size
  const header = new Uint8Array(10 + bodySize);
  header[0] = 0x49; // I
  header[1] = 0x44; // D
  header[2] = 0x33; // 3
  header[3] = 0x04; // version major
  header[4] = 0x00; // version minor
  header[5] = 0x00; // flags
  // Syncsafe integer encoding of bodySize
  header[6] = (bodySize >> 21) & 0x7f;
  header[7] = (bodySize >> 14) & 0x7f;
  header[8] = (bodySize >> 7) & 0x7f;
  header[9] = bodySize & 0x7f;
  return header;
}

describe("isValidFrameSync", () => {
  it("returns true for a valid MPEG1 Layer3 frame", () => {
    const data = makeFrameHeader();
    expect(isValidFrameSync(data, 0)).toBe(true);
  });

  it("returns true for a valid frame at non-zero offset", () => {
    const data = new Uint8Array(10);
    const header = makeFrameHeader();
    data.set(header, 4);
    expect(isValidFrameSync(data, 4)).toBe(true);
  });

  it("returns false for non-sync bytes", () => {
    const data = new Uint8Array([0x00, 0x00, 0x00, 0x00]);
    expect(isValidFrameSync(data, 0)).toBe(false);
  });

  it("returns false when sync word present but bitrate is 0xF (invalid)", () => {
    // 0xFF 0xFB 0xF0 = sync OK but bitrate index = 0xF
    const data = new Uint8Array([0xff, 0xfb, 0xf0, 0x00]);
    expect(isValidFrameSync(data, 0)).toBe(false);
  });

  it("returns false when sync word present but sample rate is 0x3 (reserved)", () => {
    // 0xFF 0xFB 0x9C = sync OK, bitrate=128k, but sample rate index = 0x3
    const data = new Uint8Array([0xff, 0xfb, 0x9c, 0x00]);
    expect(isValidFrameSync(data, 0)).toBe(false);
  });

  it("returns false when buffer is too short", () => {
    const data = new Uint8Array([0xff, 0xfb]);
    expect(isValidFrameSync(data, 0)).toBe(false);
  });

  it("returns false when offset is near end of buffer", () => {
    const data = new Uint8Array(5);
    expect(isValidFrameSync(data, 4)).toBe(false);
  });
});

describe("findFirstFrameSync", () => {
  it("finds frame sync at offset 0", () => {
    const data = makeFrameHeader();
    expect(findFirstFrameSync(data)).toBe(0);
  });

  it("finds frame sync after garbage bytes", () => {
    const data = new Uint8Array(20);
    data[0] = 0xAA; // garbage
    data[1] = 0xBB;
    data[2] = 0xCC;
    const header = makeFrameHeader();
    data.set(header, 8);
    expect(findFirstFrameSync(data)).toBe(8);
  });

  it("returns -1 when no valid frame sync exists", () => {
    const data = new Uint8Array(100);
    // Fill with non-sync data
    data.fill(0x42);
    expect(findFirstFrameSync(data)).toBe(-1);
  });

  it("skips false sync (0xFF 0xE0 but invalid bitrate)", () => {
    const data = new Uint8Array(20);
    // False sync: bitrate = 0xF
    data[0] = 0xff;
    data[1] = 0xfb;
    data[2] = 0xf0; // invalid bitrate
    data[3] = 0x00;
    // Real sync at offset 8
    const header = makeFrameHeader();
    data.set(header, 8);
    expect(findFirstFrameSync(data)).toBe(8);
  });
});

describe("getID3v2Size", () => {
  it("returns 0 for non-ID3 data", () => {
    const data = makeFrameHeader();
    expect(getID3v2Size(data)).toBe(0);
  });

  it("returns correct size for small ID3 tag", () => {
    const tag = makeID3v2Tag(100);
    expect(getID3v2Size(tag)).toBe(110); // 10 header + 100 body
  });

  it("returns correct size for larger ID3 tag", () => {
    const tag = makeID3v2Tag(2048);
    expect(getID3v2Size(tag)).toBe(2058); // 10 header + 2048 body
  });

  it("returns 0 for buffer too short", () => {
    const data = new Uint8Array(5);
    expect(getID3v2Size(data)).toBe(0);
  });

  it("returns 0 when first bytes are not ID3", () => {
    const data = new Uint8Array(20);
    data[0] = 0x49; // I
    data[1] = 0x44; // D
    data[2] = 0x00; // not '3'
    expect(getID3v2Size(data)).toBe(0);
  });
});
