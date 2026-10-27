/* IndexedDB 저장소. 데이터는 이 기기의 브라우저 안에만 있다. */
import Dexie, { type EntityTable } from 'dexie';
import type { AppData, Fund, Household, Period, Settings } from '../lib/schema';

type Singleton<T> = { key: 'main'; value: T };

export class WaterDB extends Dexie {
  settings!: EntityTable<Singleton<Settings>, 'key'>;
  fund!: EntityTable<Singleton<Fund>, 'key'>;
  households!: EntityTable<Household, 'id'>;
  periods!: EntityTable<Period, 'id'>;

  constructor(name = 'yegreen-water') {
    super(name);
    this.version(1).stores({ settings: 'key', fund: 'key', households: 'id', periods: 'id' });
  }
}

export const db = new WaterDB();

export class Repo {
  constructor(private readonly d: WaterDB = db) {}

  /** 저장된 데이터가 없으면 null (최초 실행) */
  async load(): Promise<AppData | null> {
    return this.d.transaction('r', [this.d.settings, this.d.fund, this.d.households, this.d.periods], async () => {
      const s = await this.d.settings.get('main');
      if (!s) return null;
      const f = await this.d.fund.get('main');
      return {
        settings: s.value,
        fund: f?.value ?? { start: null, unit3: {}, expenses: [] },
        households: await this.d.households.toArray(),
        periods: await this.d.periods.toArray(),
      };
    });
  }

  /** 전체를 지우고 새 데이터로 바꾼다 (백업 불러오기, 빈 상태로 시작) */
  async replaceAll(data: AppData): Promise<void> {
    await this.d.transaction('rw', [this.d.settings, this.d.fund, this.d.households, this.d.periods], async () => {
      await Promise.all([this.d.settings.clear(), this.d.fund.clear(), this.d.households.clear(), this.d.periods.clear()]);
      await this.d.settings.put({ key: 'main', value: data.settings });
      await this.d.fund.put({ key: 'main', value: data.fund });
      await this.d.households.bulkPut(data.households);
      await this.d.periods.bulkPut(data.periods);
    });
  }

  async saveSettings(settings: Settings) {
    await this.d.settings.put({ key: 'main', value: settings });
  }

  async saveFund(fund: Fund) {
    await this.d.fund.put({ key: 'main', value: fund });
  }

  async saveHouseholds(households: Household[]) {
    await this.d.transaction('rw', this.d.households, async () => {
      await this.d.households.clear();
      await this.d.households.bulkPut(households);
    });
  }

  async savePeriods(periods: Period[]) {
    await this.d.periods.bulkPut(periods);
  }

  async clearAll() {
    await this.d.transaction('rw', [this.d.settings, this.d.fund, this.d.households, this.d.periods], async () => {
      await Promise.all([this.d.settings.clear(), this.d.fund.clear(), this.d.households.clear(), this.d.periods.clear()]);
    });
  }
}

export const repo = new Repo();
