module.exports = {
  overrides: [
    {
      files: ['**/*.js'],
      parser: 'babel-eslint',
      parserOptions: {
        ecmaVersion: 2020,
      },
      extends: ['standard', 'plugin:node/recommended'],
      plugins: ['babel', 'promise', 'jest'],
      env: {
        browser: true,
        'jest/globals': true,
      },
      rules: {
        'brace-style': [2, '1tbs'],
        'comma-dangle': [2, 'always-multiline'],
        indent: ['error', 2, { SwitchCase: 1 }],
        'jsx-quotes': [2, 'prefer-single'],
        'key-spacing': 0,
        'max-len': [0, 120, 2],
        'no-unused-vars': [1, { vars: 'all', args: 'after-used', ignoreRestSiblings: false }],
        'no-var': 1,
        'object-curly-spacing': [2, 'always'],
        'prefer-const': [
          1,
          {
            destructuring: 'any',
            ignoreReadBeforeAssign: true,
          },
        ],
        semi: [2, 'never'],
        'space-in-parens': ['error', 'never'],
      },
    },
    {
      files: ['**/*.ts', '**/*.tsx'],
      parser: '@typescript-eslint/parser', // Specifies the ESLint parser
      parserOptions: {
        ecmaVersion: 2020, // Allows for the parsing of modern ECMAScript features
        sourceType: 'module', // Allows for the use of imports
      },
      extends: [
        'plugin:@typescript-eslint/recommended', // Uses the recommended rules from the @typescript-eslint/eslint-plugin
        'prettier/@typescript-eslint', // Uses eslint-config-prettier to disable ESLint rules from @typescript-eslint/eslint-plugin that would conflict with prettier
        'plugin:prettier/recommended', // Enables eslint-plugin-prettier and eslint-config-prettier. This will display prettier errors as ESLint errors. Make sure this is always the last configuration in the extends array.
      ],
      rules: {
        // Place to specify ESLint rules. Can be used to overwrite rules specified from the extended configs
        // e.g. "@typescript-eslint/explicit-function-return-type": "off",
      },
    },
  ],
}
