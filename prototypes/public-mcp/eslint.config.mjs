import tseslint from "typescript-eslint";
export default [
  { ignores: ["node_modules/**", "dist/**", ".test-build/**"] },
  ...tseslint.configs.recommended,
  { files: ["**/*.ts"], rules: { "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }] } },
];
