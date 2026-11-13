import os from 'node:os';
import qrcode from 'qrcode-terminal';
import { loadConfig } from './config.js';
import { pairUrl } from './net.js';

const config = await loadConfig();
const url = pairUrl(config.port, config.token);
console.log(`\nCouch Remote on ${os.hostname()}\n`);
console.log('Scan this with your phone camera, then add the page to your home screen:\n');
qrcode.generate(url, { small: true });
console.log(`\n${url}\n`);
