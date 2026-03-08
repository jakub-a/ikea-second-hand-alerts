export default [
  {
    files: ["src/**/*.{js,jsx}"],
    ignores: ["coverage/**"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parserOptions: {
        ecmaFeatures: {
          jsx: true
        }
      }
    },
    rules: {
      complexity: ["warn", 10],
      "max-depth": ["warn", 4],
      "max-lines-per-function": [
        "warn",
        {
          max: 120,
          skipBlankLines: true,
          skipComments: true,
          IIFEs: true
        }
      ]
    }
  }
];
