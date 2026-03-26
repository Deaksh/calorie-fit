export type Sex = 'male' | 'female' | 'other';
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
export type Goal = 'lose_fat' | 'maintain' | 'gain_muscle';

export type Profile = {
  age: number;
  sex: Sex;
  heightCm: number;
  weightKg: number;
  activityLevel: ActivityLevel;
  goal: Goal;
  fastingHours?: number;
  eatingWindowHours?: number;
  eatingWindowStart?: string;
  eatingWindowEnd?: string;
  preferences?: string;
  region?: string;
  state?: string;
  city?: string;
};

export type MacroTargets = {
  protein_g: number;
  carbs_g: number;
  fat_g: number;
};

export type TargetsResponse = {
  bmr: number;
  tdee: number;
  calories: number;
  macros: MacroTargets;
};

export type MealItem = {
  name: string;
  quantity?: number | null;
  unit?: string | null;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
};

export type MealEstimate = {
  items: MealItem[];
  total_calories: number;
  total_protein_g: number;
  total_carbs_g: number;
  total_fat_g: number;
  confidence: number;
};

export type CuisineResponse = {
  cuisines: string[];
  specialties: string[];
};

export type ApiError = { error: string };

export function isApiError(value: unknown): value is ApiError {
  return typeof value === 'object' && value !== null && 'error' in value;
}

export { defaultProfile } from './formDefaults';
export { profileFields, fastingFields } from './ui';
export { palette } from './theme';
export { formatMealTotals } from './format';
export { sexOptions, activityOptions, goalOptions, fastingOptions, eatingWindowOptions, regionOptions, indiaStates } from './options';
