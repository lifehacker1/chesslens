import { readFile, writeFile, mkdir, copyFile } from "node:fs/promises";
import { resolve, join, dirname } from "node:path";
import ts from "typescript";
import { chromium } from "@playwright/test";
const destination = resolve(process.argv[2] || "dist/pieces");
const withPng = process.argv.includes("--png");
const source = await readFile("src/pieces.ts", "utf8");
const js = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
const { pieceSvg, pieceNames } = await import(
  "data:text/javascript;base64," + Buffer.from(js).toString("base64")
);
const types = ["k", "q", "r", "b", "n", "p"];
const assets = [];
for (const finish of ["sculpted", "flat"])
  for (const color of ["w", "b"])
    for (const type of types) {
      const name = `${color}-${pieceNames[type].toLowerCase()}`;
      const path = join(destination, "svg", finish, name + ".svg");
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, pieceSvg(type, color, finish, `${finish}-${name}`));
      assets.push({
        name,
        color,
        type,
        finish,
        path: `svg/${finish}/${name}.svg`,
      });
    }
await copyFile("LICENSE", join(destination, "LICENSE.txt"));
await writeFile(
  join(destination, "README.txt"),
  `ChessLens Original Piece Collection\n\nOriginal vector artwork authored for ChessLens. MIT license (LICENSE.txt).\nAll 12 pieces have Sculpted and Flat SVG masters. ViewBox: 64 x 64.\nSVG is resolution independent: use it for the web app, Full HD, 4K or print.\nThe optional PNG pack contains transparent 512 x 512 and 4096 x 4096 exports of the Sculpted finish. These files are not downloaded by the ChessLens app.\n\nSource: src/pieces.ts. Export: npm run export:pieces -- <destination> --png.\n`,
);
if (withPng) {
  const browser = await chromium.launch({
    channel: process.env.CHESSLENS_TEST_BROWSER || "msedge",
  });
  try {
    const page = await browser.newPage({ deviceScaleFactor: 1 });
    for (const size of [512, 4096]) {
      await page.setViewportSize({ width: size, height: size });
      await mkdir(join(destination, "png", String(size)), { recursive: true });
      for (const { name, type, color } of assets.filter(
        (x) => x.finish === "sculpted",
      )) {
        await page.setContent(
          `<style>html,body{margin:0;width:100%;height:100%;background:transparent}svg{display:block;width:100%;height:100%}</style>${pieceSvg(type, color, "sculpted", `png-${name}`)}`,
        );
        await page.screenshot({
          path: join(destination, "png", String(size), name + ".png"),
          omitBackground: true,
        });
      }
    }
    for (const finish of ["sculpted", "flat"]) {
      await page.setViewportSize({ width: 1280, height: 760 });
      const row = (color) =>
        `<div class="row-label">${color === "w" ? "IVORY / WHITE" : "EBONY / BLACK"}</div><div class="collection">${types.map((type) => `<div><div class="tile"><div class="light">${pieceSvg(type, color, finish, `${finish}-${color}-${type}-light`)}</div><div class="dark">${pieceSvg(type, color, finish, `${finish}-${color}-${type}-dark`)}</div></div><p>${pieceNames[type]}</p></div>`).join("")}</div>`;
      const html = `<!doctype html><style>*{box-sizing:border-box}body{margin:0;padding:34px 40px;background:#101d17;color:#eaf7ef;font-family:system-ui,sans-serif}header{display:flex;align-items:flex-end;justify-content:space-between;border-bottom:1px solid #365242;padding-bottom:20px;margin-bottom:22px}h1{font-size:34px;letter-spacing:-1px;margin:4px 0 0;font-weight:600}.eyebrow{color:#95ddbb;font-size:11px;letter-spacing:3px}.meta{text-align:right;color:#afc9b9;font-size:12px;line-height:1.8}.row-label{font-size:10px;letter-spacing:2px;color:#a2c2ae;margin:18px 0 10px}.collection{display:grid;grid-template-columns:repeat(6,1fr);gap:14px}.tile{display:grid;grid-template-columns:1fr 1fr;height:173px;border:1px solid #769080;border-radius:9px;overflow:hidden}.tile>div{display:flex;align-items:center;justify-content:center}.light{background:#eeeed2}.dark{background:#769656}.tile svg{width:100%;height:auto;max-height:130px;filter:drop-shadow(0 2px 1px #0003)}.collection p{margin:8px 0 0;font-size:11px;color:#b9cebf;text-align:center}footer{margin-top:25px;padding-top:15px;border-top:1px solid #365242;font-size:11px;color:#a6c3b0;display:flex;justify-content:space-between}</style><header><div><div class="eyebrow">CHESSLENS · ORIGINAL COLLECTION</div><h1>${finish === "sculpted" ? "Sculpted Staunton" : "Flat Staunton"}</h1></div><div class="meta">12 pieces · Authored SVG masters<br/>512px + 4096px transparent exports</div></header>${row("w")}${row("b")}<footer><span>One vector master. Sharp at every screen size.</span><span>MIT licensed · No external piece artwork</span></footer>`;
      await writeFile(join(destination, `preview-${finish}.html`), html);
      await page.setContent(html);
      await page.screenshot({
        path: join(destination, `preview-${finish}.png`),
        fullPage: true,
      });
    }
    await page.close();
  } finally {
    await browser.close();
  }
}
await writeFile(
  join(destination, "manifest.json"),
  JSON.stringify(
    {
      collection: "ChessLens Original Piece Collection",
      license: "MIT",
      viewBox: "0 0 64 64",
      assets,
    },
    null,
    2,
  ),
);
console.log(
  `Exported ${assets.length} SVG masters${withPng ? ", 24 transparent PNGs and two design previews" : ""} to ${destination}`,
);
