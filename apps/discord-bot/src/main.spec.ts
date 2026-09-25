import { resolveInitialConfig } from './main';

describe('resolveInitialConfig', () => {
  it('Redis 有 token → 直接用 Redis 設定，無種子', () => {
    const { config, seed } = resolveInitialConfig(
      { token: 'redis-tok', channelId: '123' },
      { token: 'env-tok', channelId: '999' }
    );
    expect(config).toEqual({ token: 'redis-tok', channelId: '123' });
    expect(seed).toBeNull();
  });

  it('Redis 無 token 但 env 有 token → 用 env 值並回傳種子', () => {
    const { config, seed } = resolveInitialConfig(
      { token: null, channelId: null },
      { token: 'env-tok', channelId: '456' }
    );
    expect(config).toEqual({ token: 'env-tok', channelId: '456' });
    expect(seed).toEqual({ token: 'env-tok', channelId: '456' });
  });

  it('兩者皆無 token → 空 token 待命，無種子', () => {
    const { config, seed } = resolveInitialConfig(
      { token: null, channelId: null },
      {}
    );
    expect(config.token).toBeNull();
    expect(seed).toBeNull();
  });

  it('Redis 無 token、env 無 token 時保留 Redis channelId', () => {
    const { config } = resolveInitialConfig(
      { token: null, channelId: '789' },
      {}
    );
    expect(config).toEqual({ token: null, channelId: '789' });
  });

  it('env token 為空白字串視為無 token', () => {
    const { config, seed } = resolveInitialConfig(
      { token: null, channelId: null },
      { token: '   ' }
    );
    expect(config.token).toBeNull();
    expect(seed).toBeNull();
  });
});
