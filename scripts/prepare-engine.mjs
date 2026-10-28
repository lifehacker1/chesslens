import { mkdir, copyFile, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
const destination = "public/engine";
await mkdir(destination, { recursive: true });
for (const name of [
  "stockfish-19-single.js",
  "stockfish-19-single.wasm",
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
  "stockfish-19-single.js",
  "stockfish-19-single.wasm",
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

const lozza = JSON.parse(
  await readFile("vendor/lozza-12.1/manifest.json", "utf8"),
);
await mkdir(destination + "/lozza", { recursive: true });
for (const [file, hash] of Object.entries(lozza.files)) {
  const bytes = await readFile("vendor/lozza-12.1/" + file);
  if (createHash("sha256").update(bytes).digest("hex") !== hash)
    throw new Error("Lozza checksum mismatch: " + file);
  await writeFile(destination + "/lozza/" + file, bytes);
}
await copyFile(
  "vendor/lozza-12.1/manifest.json",
  destination + "/lozza/manifest.json",
);
console.log(
  "Prepared pinned Lozza 12.1 NNUE and HCE workers with MIT notices.",
);
