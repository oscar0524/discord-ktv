import { BotConnection } from './connection';

function makeConn() {
  const login = jest.fn<Promise<void>, [string]>().mockResolvedValue(undefined);
  const destroy = jest.fn<Promise<void>, []>().mockResolvedValue(undefined);
  const conn = new BotConnection({ login, destroy, log: () => undefined });
  return { conn, login, destroy };
}

describe('BotConnection', () => {
  it('無 token 時進入待命，不 login', async () => {
    const { conn, login, destroy } = makeConn();
    const relogin = await conn.applyConfig({ token: null, channelId: null });
    expect(relogin).toBe(false);
    expect(login).not.toHaveBeenCalled();
    expect(destroy).not.toHaveBeenCalled();
    expect(conn.isConnected()).toBe(false);
  });

  it('待命 → 設定 token 會 login', async () => {
    const { conn, login } = makeConn();
    const relogin = await conn.applyConfig({ token: 'abc', channelId: null });
    expect(relogin).toBe(true);
    expect(login).toHaveBeenCalledWith('abc');
    expect(conn.isConnected()).toBe(true);
  });

  it('token 變更會先 destroy 再 login', async () => {
    const { conn, login, destroy } = makeConn();
    await conn.applyConfig({ token: 'abc', channelId: null });
    login.mockClear();
    const relogin = await conn.applyConfig({ token: 'xyz', channelId: null });
    expect(relogin).toBe(true);
    expect(destroy).toHaveBeenCalledTimes(1);
    expect(login).toHaveBeenCalledWith('xyz');
  });

  it('相同 token 不重連', async () => {
    const { conn, login, destroy } = makeConn();
    await conn.applyConfig({ token: 'abc', channelId: null });
    login.mockClear();
    destroy.mockClear();
    const relogin = await conn.applyConfig({ token: 'abc', channelId: '123' });
    expect(relogin).toBe(false);
    expect(login).not.toHaveBeenCalled();
    expect(destroy).not.toHaveBeenCalled();
    // channelId 仍然更新
    expect(conn.getAllowedChannel()).toBe('123');
  });

  it('清掉 token 會 destroy 進待命', async () => {
    const { conn, destroy } = makeConn();
    await conn.applyConfig({ token: 'abc', channelId: null });
    const relogin = await conn.applyConfig({ token: null, channelId: null });
    expect(relogin).toBe(false);
    expect(destroy).toHaveBeenCalledTimes(1);
    expect(conn.isConnected()).toBe(false);
  });

  it('channelId 過濾：null 全部允許，設定後只允許相符', async () => {
    const { conn } = makeConn();
    await conn.applyConfig({ token: 'abc', channelId: null });
    expect(conn.isChannelAllowed('anything')).toBe(true);
    await conn.applyConfig({ token: 'abc', channelId: '999' });
    expect(conn.isChannelAllowed('999')).toBe(true);
    expect(conn.isChannelAllowed('111')).toBe(false);
  });

  it('token 前後空白會被 trim，視為相同不重連', async () => {
    const { conn, login } = makeConn();
    await conn.applyConfig({ token: 'abc', channelId: null });
    login.mockClear();
    const relogin = await conn.applyConfig({ token: '  abc  ', channelId: null });
    expect(relogin).toBe(false);
    expect(login).not.toHaveBeenCalled();
  });
});
