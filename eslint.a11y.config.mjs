// Audit aksesibilitas (Orang 2, Minggu 3). Jalankan:
//   npx eslint -c eslint.a11y.config.mjs app components
// Memakai seluruh aturan "recommended" dari eslint-plugin-jsx-a11y
// (jauh lebih ketat daripada aturan bawaan Next.js yang dipakai CI).
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import jsxA11y from "eslint-plugin-jsx-a11y";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    rules: { ...jsxA11y.flatConfigs.recommended.rules },
  },
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
]);
