const sqlMock = jest.fn(() => Promise.resolve([]));

export class SQLocal {
  public sql = sqlMock;
}

jest.mock('sqlocal', () => ({
  __esModule: true,
  SQLocal,
}));
