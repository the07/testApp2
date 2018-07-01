import { readFileSync } from 'fs';
import { resolve } from 'path';

const basePath = resolve(__dirname, '../certs');
const readCryptoFile = filename => readFileSync(resolve(basePath, filename)).toString();
const config = {
  channelName: 'mychannel',
  channelConfig: readFileSync(resolve(__dirname, '../channel.tx')),
  chaincodeId: 'peoplechain',
  chaincodeVersion: 'v2',
  orderer: {
    hostname: 'orderer',
    url: 'grpcs://orderer.example.com:7050',
    pem: readCryptoFile('orderer.pem')
  },

}
