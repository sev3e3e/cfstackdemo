import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const wranglerPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "./.wrangler"
);
const drizzlePath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "./drizzle"
);

(async () => {
  try {
    await fs.promises.rm(wranglerPath, { recursive: true });
    await fs.promises.mkdir(wranglerPath);
  } catch (error) {
    if ((error.code = "ENOENT")) {
      await fs.promises.mkdir(wranglerPath);
    } else {
      console.log(error);
    }
  }
})();

(async () => {
  try {
    await fs.promises.rm(drizzlePath, { recursive: true });
    await fs.promises.mkdir(drizzlePath);
  } catch (error) {
    if ((error.code = "ENOENT")) {
      await fs.promises.mkdir(drizzlePath);
    } else {
      console.log(error);
    }
  }
})();
