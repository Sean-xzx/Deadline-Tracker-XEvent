const fs = require('node:fs');
const sharp = require('sharp');
(async()=>{
  const sizes = [16,24,32,48,64,128,256];
  const images = await Promise.all(sizes.map(size=>sharp('assets/icon.svg').resize(size,size).png().toBuffer()));
  const head = Buffer.alloc(6+16*sizes.length);
  head.writeUInt16LE(1,2);head.writeUInt16LE(sizes.length,4);
  let offset = head.length;
  images.forEach((buffer,i)=>{const entry=6+i*16;head[entry]=sizes[i]===256?0:sizes[i];head[entry+1]=head[entry];head.writeUInt16LE(1,entry+4);head.writeUInt16LE(32,entry+6);head.writeUInt32LE(buffer.length,entry+8);head.writeUInt32LE(offset,entry+12);offset+=buffer.length;});
  fs.writeFileSync('assets/icon.ico',Buffer.concat([head,...images]));
  await sharp('assets/icon.svg').resize(256,256).png().toFile('assets/icon.png');
  console.log('应用图标已生成');
})().catch(error=>{console.error(error);process.exitCode=1;});
