import nextJest from 'next/jest.js'

const createJestConfig = nextJest({ dir: './' })

const customConfig: Record<string, unknown> = {
  coverageProvider:    'v8',
  testEnvironment:     'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  testMatch:              ['**/__tests__/**/*.test.{ts,tsx}'],
  testPathIgnorePatterns: ['/node_modules/', '/.next/'],
}

export default createJestConfig(customConfig)
