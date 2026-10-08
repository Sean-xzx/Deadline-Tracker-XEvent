const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve('app');
const types = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml'};
http.createServer((request,response)=>{
  const file = path.resolve(root, '.'+decodeURIComponent(request.url.split('?')[0]==='/'?'/index.html':request.url.split('?')[0]));
  if(!file.startsWith(root+path.sep)){response.writeHead(403);return response.end();}
  fs.readFile(file,(error,data)=>{if(error){response.writeHead(404);return response.end('Not found');}response.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'});response.end(data);});
}).listen(4173,'127.0.0.1',()=>console.log('预览地址：http://127.0.0.1:4173'));
