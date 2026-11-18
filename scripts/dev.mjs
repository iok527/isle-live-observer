import {readFileSync} from 'node:fs';
import {context} from 'esbuild';
import {startServer,options} from './server.mjs';
const ctx=await context({entryPoints:['src/observer-v10.jsx'],bundle:true,minify:true,define:{'process.env.NODE_ENV':'"production"'},outfile:'dist/observer-v10.js',sourcemap:true});
await ctx.rebuild();await ctx.watch();
const server=startServer(options(5173),(pathname,request,response)=>{
  if(pathname!=='/art-calibration'&&pathname!=='/art-calibration.js')return false;
  const isPage=pathname==='/art-calibration';
  const content=isPage
    ? readFileSync(new URL('../dist/index.html',import.meta.url),'utf8').replace(
      '<script src="observer-bridge.js"></script>',
      '<script src="art-calibration.js"></script>\n<script src="observer-bridge.js"></script>',
    )
    : readFileSync(new URL('../dev/art-calibration.js',import.meta.url),'utf8');
  response.writeHead(200,{'Content-Type':isPage?'text/html; charset=utf-8':'text/javascript; charset=utf-8','Cache-Control':'no-store'});
  response.end(request.method==='HEAD'?undefined:content);
  return true;
});
async function stop(){server.close();await ctx.dispose();process.exit(0);}process.on('SIGINT',stop);process.on('SIGTERM',stop);
console.log('Watching React source. Refresh the browser after edits; HMR is not configured.');
