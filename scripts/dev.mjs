import {context} from 'esbuild';
import {startServer,options} from './server.mjs';
const ctx=await context({entryPoints:['src/observer-v10.jsx'],bundle:true,minify:true,define:{'process.env.NODE_ENV':'"production"'},outfile:'dist/observer-v10.js',sourcemap:true});
await ctx.rebuild();await ctx.watch();
const server=startServer(options(5173));
async function stop(){server.close();await ctx.dispose();process.exit(0);}process.on('SIGINT',stop);process.on('SIGTERM',stop);
console.log('Watching React source. Refresh the browser after edits; HMR is not configured.');
