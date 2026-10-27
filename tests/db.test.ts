import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { Repo, WaterDB } from '../src/db/db';
import { emptyData } from '../src/lib/defaults';
import { fakeData, fakePeriod } from './fake';

let n = 0;
const open = () => {
  const d = new WaterDB(`test-${++n}`);
  return { d, repo: new Repo(d) };
};
let current: WaterDB | null = null;
afterEach(async () => {
  await current?.delete();
});

describe('IndexedDB 저장소', () => {
  it('처음에는 비어 있다', async () => {
    const { d, repo } = open();
    current = d;
    expect(await repo.load()).toBeNull();
  });

  it('전체 저장 후 그대로 읽는다', async () => {
    const { d, repo } = open();
    current = d;
    const data = fakeData();
    await repo.replaceAll(data);
    const got = await repo.load();
    expect(got?.settings).toEqual(data.settings);
    expect(got?.fund).toEqual(data.fund);
    expect(got?.periods).toEqual(data.periods);
    expect(got?.households).toHaveLength(3);
  });

  it('덮어쓰기는 이전 데이터를 남기지 않는다', async () => {
    const { d, repo } = open();
    current = d;
    await repo.replaceAll(fakeData({ periods: [fakePeriod(), fakePeriod({ id: '2030-05', m1: 5 })] }));
    await repo.replaceAll(emptyData());
    const got = await repo.load();
    expect(got?.periods).toEqual([]);
    expect(got?.households).toHaveLength(26);
  });

  it('회차 하나만 저장해도 나머지는 유지된다', async () => {
    const { d, repo } = open();
    current = d;
    await repo.replaceAll(fakeData());
    await repo.savePeriods([fakePeriod({ bill: 1 })]);
    const got = await repo.load();
    expect(got?.periods[0].bill).toBe(1);
    expect(got?.settings.companyName).toBe('테스트관리');
  });

  it('전체 삭제 후에는 최초 실행 상태', async () => {
    const { d, repo } = open();
    current = d;
    await repo.replaceAll(fakeData());
    await repo.clearAll();
    expect(await repo.load()).toBeNull();
  });
});
