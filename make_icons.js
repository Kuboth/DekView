const fs = require('fs');
const zlib = require('zlib');
const path = require('path');

function createPng(width, height) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData.writeUInt8(8, 8); // 8-bit depth
  ihdrData.writeUInt8(2, 9); // truecolor RGB
  ihdrData.writeUInt8(0, 10);
  ihdrData.writeUInt8(0, 11);
  ihdrData.writeUInt8(0, 12);
  
  function crc32(buf) {
    let crc = -1;
    for (let i = 0; i < buf.length; i++) {
      let byte = buf[i];
      for (let j = 0; j < 8; j++) {
        let bit = (crc ^ (byte >> j)) & 1;
        crc = (crc >>> 1) ^ (bit ? 0xedb88320 : 0);
      }
    }
    return (crc ^ (-1)) >>> 0;
  }

  function makeChunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type, 'ascii');
    const toCrc = Buffer.concat([typeBuf, data]);
    const crc = crc32(toCrc);
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crc, 0);
    return Buffer.concat([len, typeBuf, data, crcBuf]);
  }

  const rawData = [];
  for (let y = 0; y < height; y++) {
    rawData.push(0); // filter 0
    for (let x = 0; x < width; x++) {
      rawData.push(37);  // R: 37 (#2563eb)
      rawData.push(99);  // G: 99
      rawData.push(235); // B: 235
    }
  }

  const compressed = zlib.deflateSync(Buffer.from(rawData));
  return Buffer.concat([
    signature,
    makeChunk('IHDR', ihdrData),
    makeChunk('IDAT', compressed),
    makeChunk('IEND', Buffer.alloc(0))
  ]);
}

fs.writeFileSync(path.join(__dirname, 'icon-192.png'), createPng(192, 192));
fs.writeFileSync(path.join(__dirname, 'icon-512.png'), createPng(512, 512));
console.log('PNG Icons successfully created!');
