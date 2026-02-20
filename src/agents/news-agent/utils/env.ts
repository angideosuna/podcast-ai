// Carga variables de entorno desde .env.local
// Necesario porque los scripts CLI corren fuera de Next.js

import { config } from "dotenv";
import { resolve } from "path";

export function loadEnv(): void {
  config({ path: resolve(process.cwd(), ".env.local") });
}
