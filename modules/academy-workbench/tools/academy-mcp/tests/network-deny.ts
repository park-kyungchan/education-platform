import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import tls from 'node:tls';
import { syncBuiltinESMExports } from 'node:module';

function deny(): never {
  process.stderr.write('verification_outbound_network_attempt_blocked\n');
  throw Error('verification_outbound_network_forbidden');
}
globalThis.fetch = Object.assign(deny, { preconnect: deny });
http.request = deny as typeof http.request;
http.get = deny as typeof http.get;
https.request = deny as typeof https.request;
https.get = deny as typeof https.get;
net.connect = deny as typeof net.connect;
net.createConnection = deny as typeof net.createConnection;
net.Socket.prototype.connect = deny as typeof net.Socket.prototype.connect;
tls.connect = deny as typeof tls.connect;
syncBuiltinESMExports();
