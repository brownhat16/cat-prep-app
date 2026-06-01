import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distDir = path.join(__dirname, "dist");
const backendBaseUrl = (process.env.ADMIN_BACKEND_URL || "https://cat-backend-bdyo.onrender.com").replace(/\/+$/, "");

await rm(distDir, { recursive: true, force: true });
await mkdir(distDir, { recursive: true });

for (const file of ["index.html", "styles.css", "app.js"]) {
  await cp(path.join(__dirname, file), path.join(distDir, file));
}

const configJs = `window.APP_CONFIG = {
  backendBaseUrl: ${JSON.stringify(backendBaseUrl)},
};
`;

await writeFile(path.join(distDir, "config.js"), configJs, "utf8");
console.log("Web app frontend built successfully in dist/");
