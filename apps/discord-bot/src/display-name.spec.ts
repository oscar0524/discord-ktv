import { resolveDisplayName } from './display-name';

describe('resolveDisplayName', () => {
  it('有 memberDisplayName 時優先取之（server nickname）', () => {
    expect(
      resolveDisplayName({
        memberDisplayName: '小明',
        globalName: 'Ming',
        username: 'ming123',
      })
    ).toBe('小明');
  });

  it('memberDisplayName 為 null 時取 globalName', () => {
    expect(
      resolveDisplayName({
        memberDisplayName: null,
        globalName: 'Ming',
        username: 'ming123',
      })
    ).toBe('Ming');
  });

  it('memberDisplayName 為 undefined 時取 globalName', () => {
    expect(
      resolveDisplayName({
        globalName: 'Ming',
        username: 'ming123',
      })
    ).toBe('Ming');
  });

  it('memberDisplayName 與 globalName 皆空時取 username', () => {
    expect(
      resolveDisplayName({
        memberDisplayName: null,
        globalName: null,
        username: 'ming123',
      })
    ).toBe('ming123');
  });

  it('空白字串視為未設定，往下 fallback', () => {
    expect(
      resolveDisplayName({
        memberDisplayName: '   ',
        globalName: '  ',
        username: 'ming123',
      })
    ).toBe('ming123');
  });

  it('memberDisplayName 空白但 globalName 有值 → 取 globalName', () => {
    expect(
      resolveDisplayName({
        memberDisplayName: '   ',
        globalName: 'Ming',
        username: 'ming123',
      })
    ).toBe('Ming');
  });

  it('回傳值會去除前後空白', () => {
    expect(
      resolveDisplayName({
        memberDisplayName: '  小明  ',
        username: 'ming123',
      })
    ).toBe('小明');
  });
});
