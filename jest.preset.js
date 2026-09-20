/**
 * 共用 Jest preset。各專案的 jest.config.ts 會 extend 這個檔案。
 * 使用 ts-jest 直接跑 TypeScript，並透過 moduleNameMapper 對應 workspace path alias。
 */
module.exports = {
  transform: {
    '^.+\\.[tj]sx?$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/tsconfig.spec.json',
      },
    ],
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  moduleNameMapper: {
    '^@discord-ktv/shared-types$': '<rootDir>/../../libs/shared-types/src/index.ts',
    '^@discord-ktv/youtube-utils$': '<rootDir>/../../libs/youtube-utils/src/index.ts',
    '^@discord-ktv/redis-client$': '<rootDir>/../../libs/redis-client/src/index.ts',
  },
  testMatch: ['**/?(*.)+(spec|test).[jt]s?(x)'],
};
