import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: ["dist/**", "node_modules/**"],
  },
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        // test/**/*.ts vive fuera de tsconfig.json (rootDir: src, ver ahí el porqué):
        // se lintan con un programa de un solo fichero en vez de romper el build config.
        projectService: {
          allowDefaultProject: ["eslint.config.js", "test/*.ts"],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",
    },
  }
);
