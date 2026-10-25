import { mkdir, copyFile, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
const destination = "public/engine";
await mkdir(destination, { recursive: true });
for (const name of [
  "stockfish-19-lite-single.js",
  "stockfish-19-lite-single.wasm",
])
  await copyFile(
    `node_modules/stockfish/bin/${name}`,
    `${destination}/${name}`,
  );
await copyFile(
  "node_modules/stockfish/Copying.txt",
  `${destination}/COPYING.txt`,
);
await copyFile(
  "public/stockfish-source.tar.gz",
  `${destination}/stockfish-source.tar.gz`,
);
const hashes = {};
for (const name of [
  "stockfish-19-lite-single.js",
  "stockfish-19-lite-single.wasm",
  "stockfish-source.tar.gz",
])
  hashes[name] = createHash("sha256")
    .update(await readFile(`${destination}/${name}`))
    .digest("hex");
await writeFile(
  `${destination}/checksums.json`,
  JSON.stringify(hashes, null, 2) + "\n",
);
console.log(
  "Prepared Stockfish 19.0.1, GPLv3 license, and corresponding source archive.",
);
