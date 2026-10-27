import type { Lang } from '../config';
import { en } from './en';
import { es } from './es';
import { fr } from './fr';
import { ja } from './ja';
import { ko } from './ko';
import { vi, type Messages } from './vi';
import { zh } from './zh';

// Chỉ dùng ở máy chủ: trình duyệt nhận phần chữ cần thiết qua I18nProvider.
export const DICTS: Record<Lang, Messages> = { vi, en, zh, ja, ko, fr, es };
export type { MessageKey, Messages } from './vi';
