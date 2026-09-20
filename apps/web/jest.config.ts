export default {
  displayName: 'web',
  preset: '../../jest.preset.js',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/src/test-setup.ts'],
  transform: {
    '^.+\\.[tj]sx?$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/tsconfig.spec.json',
      },
    ],
  },
  moduleNameMapper: {
    '^@discord-ktv/shared-types$':
      '<rootDir>/../../libs/shared-types/src/index.ts',
    // 把 env 導向 CJS 相容的 mock，避開 import.meta
    '^\\./env$': '<rootDir>/src/api/__mocks__/env.ts',
    '^\\.\\./api/env$': '<rootDir>/src/api/__mocks__/env.ts',
    '\\.(css|less|scss)$': '<rootDir>/src/__mocks__/style.ts',
  },
};
