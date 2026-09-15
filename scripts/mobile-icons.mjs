import { deflateSync } from 'node:zlib';
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const name = Buffer.from(type), size = Buffer.alloc(4), sum = Buffer.alloc(4);
  size.writeUInt32BE(data.length); sum.writeUInt32BE(crc32(Buffer.concat([name,data])));
  return Buffer.concat([size,name,data,sum]);
}
// Code-native geometric paw icon, matching prototype/icon.svg; no fonts/assets.
export function iconPNG(size) {
  const rows = Buffer.alloc((size * 3 + 1) * size);
  const ellipses = [[256,315,85,70],[151,223,32,43],[216,165,32,43],[296,165,32,43],[361,223,32,43]];
  for (let y=0; y<size; y++) for (let x=0; x<size; x++) {
    const px=(x+.5)*512/size, py=(y+.5)*512/size;
    const inside=ellipses.some(([cx,cy,rx,ry]) => ((px-cx)/rx)**2 + ((py-cy)/ry)**2 <= 1);
    const color=inside ? [246,245,239] : [34,99,79];
    const offset=y*(size*3+1)+1+x*3;
    rows.set(color,offset);
  }
  const header=Buffer.alloc(13); header.writeUInt32BE(size); header.writeUInt32BE(size,4); header[8]=8; header[9]=2;
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(rows)),chunk('IEND',Buffer.alloc(0))]);
}
