export function calculateTargets(input) {
  const data = normalize(input);
  const bmr = mifflinStJeor(data);
  const tdee = bmr * activityFactor(data.activityLevel);
  const calories = adjustForGoal(tdee, data.goal);
  const macros = macroSplit(calories, data.goal);

  return {
    bmr: round(bmr),
    tdee: round(tdee),
    calories: round(calories),
    macros
  };
}

function normalize(input) {
  const age = toNumber(input.age);
  const heightCm = toNumber(input.heightCm);
  const weightKg = toNumber(input.weightKg);
  const sex = (input.sex || '').toLowerCase();
  const activityLevel = input.activityLevel || 'moderate';
  const goal = input.goal || 'maintain';

  if (!age || !heightCm || !weightKg) {
    throw new Error('age, heightCm, and weightKg are required');
  }
  if (!['male', 'female', 'other'].includes(sex)) {
    throw new Error('sex must be male, female, or other');
  }

  return { age, heightCm, weightKg, sex, activityLevel, goal };
}

function mifflinStJeor({ sex, weightKg, heightCm, age }) {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  if (sex === 'male') return base + 5;
  if (sex === 'female') return base - 161;
  return base - 78;
}

function activityFactor(level) {
  switch (level) {
    case 'sedentary':
      return 1.2;
    case 'light':
      return 1.375;
    case 'moderate':
      return 1.55;
    case 'active':
      return 1.725;
    case 'very_active':
      return 1.9;
    default:
      return 1.55;
  }
}

function adjustForGoal(tdee, goal) {
  switch (goal) {
    case 'lose_fat':
      return tdee * 0.8;
    case 'gain_muscle':
      return tdee * 1.1;
    case 'maintain':
    default:
      return tdee;
  }
}

function macroSplit(calories, goal) {
  const proteinRatio = goal === 'gain_muscle' ? 0.3 : 0.25;
  const fatRatio = 0.25;
  const carbRatio = 1 - proteinRatio - fatRatio;

  const proteinCalories = calories * proteinRatio;
  const fatCalories = calories * fatRatio;
  const carbCalories = calories * carbRatio;

  return {
    protein_g: round(proteinCalories / 4),
    fat_g: round(fatCalories / 9),
    carbs_g: round(carbCalories / 4)
  };
}

function toNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function round(value) {
  return Math.round(value);
}
