const esbuild = require('esbuild');
const fs = require('node:fs');
fs.mkdirSync('app/assets', { recursive: true });
fs.copyFileSync('assets/icon.svg', 'app/assets/icon.svg');
esbuild.buildSync({entryPoints:['src/renderer.js'], bundle:true, minify:true, outfile:'app/bundle.js', platform:'browser', target:'chrome138', legalComments:'none'});
console.log('界面已构建');
