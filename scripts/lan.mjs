import {networkInterfaces} from 'node:os';
import {options,startServer} from './server.mjs';
import {createCaptureLanRoute} from './capture-lan.mjs';

const settings=options(4173);
const route=createCaptureLanRoute({
  directory:process.env.CAPTURE_DATA_DIR||'.capture-data',
  token:process.env.CAPTURE_UPLOAD_TOKEN,
});
const server=startServer(settings,route);
server.on('listening',()=>{
  if(settings.host!=='0.0.0.0')return;
  for(const addresses of Object.values(networkInterfaces())){
    for(const item of addresses||[]){
      if(item.family==='IPv4'&&!item.internal)console.log('Observer network candidate:',`http://${item.address}:${settings.port}/`);
    }
  }
});
