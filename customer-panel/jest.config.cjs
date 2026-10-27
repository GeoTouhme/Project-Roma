module.exports = {
  testEnvironment:'jsdom', setupFiles:['<rootDir>/test/polyfills.cjs'], setupFilesAfterEnv:['<rootDir>/src/setupTests.js'],
  transform:{'^.+\\.[jt]sx?$':'babel-jest'},
  moduleNameMapper:{'\\.(css|less|scss)$':'<rootDir>/test/styleMock.cjs','\\.(png|jpg|jpeg|gif|webp|svg)$':'<rootDir>/test/fileMock.cjs'},
};
