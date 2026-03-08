export default [
  {
    files: ["**/*.js"],
    ignores: ["dist/**", "coverage/**"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module"
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
