export type FieldConfig = {
  key: string;
  label: string;
  placeholder?: string;
  multiline?: boolean;
};

export const profileFields: FieldConfig[] = [
  { key: 'age', label: 'Age' },
  { key: 'sex', label: 'Sex (male/female/other)' },
  { key: 'heightCm', label: 'Height (cm)' },
  { key: 'weightKg', label: 'Weight (kg)' },
  { key: 'activityLevel', label: 'Activity (sedentary/light/moderate/active/very_active)' },
  { key: 'goal', label: 'Goal (lose_fat/maintain/gain_muscle)' }
];

export const fastingFields: FieldConfig[] = [
  { key: 'fastingHours', label: 'Fasting hours' },
  { key: 'eatingWindowHours', label: 'Eating window hours' },
  { key: 'eatingWindowStart', label: 'Eating window start (HH:MM)' },
  { key: 'eatingWindowEnd', label: 'Eating window end (HH:MM)' },
  { key: 'preferences', label: 'Preferences', multiline: true },
  { key: 'region', label: 'Country/Region' },
  { key: 'state', label: 'State' },
  { key: 'city', label: 'City' }
];
