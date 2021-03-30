module.exports = {
  roots: ['<rootDir>/test', '<rootDir>/src'],
  testMatch: ['**/*.test.ts', '**/*.test.js'],
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
  },
}
