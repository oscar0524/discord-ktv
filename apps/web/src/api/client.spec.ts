import { api } from './client';

// env 由 jest 的 __mocks__/env.ts 提供（API_URL = http://localhost:3333）
jest.mock('./env');

describe('api client（插歌 / 重排）', () => {
  const fetchMock = jest.fn().mockResolvedValue({ ok: true });

  beforeEach(() => {
    fetchMock.mockClear();
    (globalThis as unknown as { fetch: typeof fetch }).fetch =
      fetchMock as unknown as typeof fetch;
  });

  it('moveToFront 以正確 URL / method / body 送出', async () => {
    await api.moveToFront(1234);
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3333/control/move-front',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ songNumber: 1234 }),
      }
    );
  });

  it('reorder 以正確 URL / method / body 送出', async () => {
    await api.reorder(['a', 'b', 'c']);
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3333/control/reorder',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderedIds: ['a', 'b', 'c'] }),
      }
    );
  });
});
