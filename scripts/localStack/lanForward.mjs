#!/usr/bin/env node
// Forwards <lan address>:<port> to 127.0.0.1:<port> so a phone on the same Wi-Fi reaches the loopback-only stack.
// usage: node lanForward.mjs <lan address> <port> [<port>...]
import { createConnection, createServer } from "node:net";

const [lanAddress, ...ports] = process.argv.slice(2);
if (!lanAddress || ports.length === 0) {
  console.error("usage: lanForward.mjs <lan address> <port> [<port>...]");
  process.exit(1);
}

for (const port of ports.map(Number)) {
  const server = createServer((incoming) => {
    const outgoing = createConnection({ host: "127.0.0.1", port });
    incoming.pipe(outgoing).pipe(incoming);
    const close = () => { incoming.destroy(); outgoing.destroy(); };
    incoming.on("error", close);
    outgoing.on("error", close);
  });
  server.on("error", (error) => {
    console.error(`cannot listen on ${lanAddress}:${port}: ${error.message}`);
    process.exit(1);
  });
  server.listen(port, lanAddress, () => console.log(`forwarding ${lanAddress}:${port} -> 127.0.0.1:${port}`));
}
