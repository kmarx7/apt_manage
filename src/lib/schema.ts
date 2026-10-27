/* 저장 데이터와 백업 파일의 형식. 백업 파일은 이 스키마로 검증한 뒤에만 반영한다. */
import { z } from 'zod';

export const APP_ID = 'yegreen-water';
export const SCHEMA_VERSION = 1;

const money = z.number().finite();
const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '날짜는 YYYY-MM-DD 형식이어야 합니다');

export const TierSchema = z.object({ min: z.number().finite().min(0), fee: money });
export const MethodSchema = z.enum(['avg', 'full', 'fullMinusN']);
export const StatusSchema = z.enum(['draft', 'done', 'closed']);

export const SettingsSchema = z.object({
  bank: z.object({ name: z.string(), no: z.string(), holder: z.string() }),
  companyName: z.string(),
  elecFee: money.min(0),
  roundUnit: z.number().int().positive(),
  defaultTiers: z.array(TierSchema),
  defaultMethod: MethodSchema,
  lastBackupAt: z.string().optional(),
});

export const HouseholdSchema = z.object({
  id: z.string().min(1),
  dong: z.union([z.literal(1), z.literal(2)]),
  seq: z.number().int().positive(),
  elecOn: z.boolean(),
  active: z.boolean(),
});

export const ReadingSchema = z.object({
  prev: z.number().finite(),
  curr: z.union([z.number().finite(), z.literal('')]),
});

export const PeriodSchema = z.object({
  id: z.string().regex(/^\d{4}-\d{2}$/),
  year: z.number().int(),
  m1: z.number().int().min(1).max(11),
  status: StatusSchema,
  bill: money.min(0),
  billQty: z.number().finite().min(0),
  method: MethodSchema,
  adj: z.number().finite(),
  adjNote: z.string().default(''),
  issued: ymd.nullable(),
  tiers: z.array(TierSchema),
  readings: z.record(z.string(), ReadingSchema),
  checked: z.record(z.string(), z.boolean()),
  // 확정할 때 고정하는 값. 없으면 현재 설정을 쓴다(작성 중 회차).
  elecFee: money.min(0).optional(),
  roundUnit: z.number().int().positive().optional(),
  elecOn: z.record(z.string(), z.boolean()).optional(),
  /** 확정한 시각 (백업 알림용) */
  confirmedAt: z.string().optional(),
});

export const FundSchema = z.object({
  start: money.nullable(),
  startNote: z.string().optional(),
  // 시작 잔액 이후 장부에 넣을 첫 회차. 없으면 불러올 때 정한다.
  startPeriod: z.string().optional(),
  unit3: z.record(z.string(), z.object({ amount: money, date: z.string() })),
  expenses: z.array(z.object({ id: z.string(), date: z.string(), note: z.string(), amount: money })),
});

export const BackupSchema = z.object({
  app: z.literal(APP_ID),
  schemaVersion: z.number().int().max(SCHEMA_VERSION, '이 앱보다 새 버전에서 만든 백업입니다'),
  exportedAt: z.string(),
  settings: SettingsSchema,
  households: z.array(HouseholdSchema),
  periods: z.array(PeriodSchema),
  fund: FundSchema,
});

export type Tier = z.infer<typeof TierSchema>;
export type Method = z.infer<typeof MethodSchema>;
export type Status = z.infer<typeof StatusSchema>;
export type Settings = z.infer<typeof SettingsSchema>;
export type Household = z.infer<typeof HouseholdSchema>;
export type Reading = z.infer<typeof ReadingSchema>;
export type Period = z.infer<typeof PeriodSchema>;
export type Fund = z.infer<typeof FundSchema>;
export type Backup = z.infer<typeof BackupSchema>;

/** 앱이 다루는 전체 데이터. 백업 파일에서 머리말(app, schemaVersion, exportedAt)을 뺀 것과 같다. */
export type AppData = Omit<Backup, 'app' | 'schemaVersion' | 'exportedAt'>;
