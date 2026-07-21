import '@testing-library/jest-dom';

jest.mock('lucide-react', () => ({
  __esModule: true,
  ...require('./__mocks__/lucide-react'),
}));

jest.mock('sqlocal', () => {
  const sqlFn = jest.fn(() => []);
  return {
    __esModule: true,
    SQLocal: jest.fn().mockImplementation(() => ({
      sql: sqlFn,
    })),
  };
});

beforeEach(() => {
  jest.clearAllMocks();
});
