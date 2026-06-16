import { existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadDotenv } from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "../..");

export function loadEnv(): void {
  const envPath = resolve(root, ".env");
  if (existsSync(envPath)) {
    loadDotenv({ path: envPath });
  } else {
    loadDotenv({ path: resolve(root, ".env.example") });
  }
}
