import type { MealEstimate } from './index.js';

export function formatMealTotals(estimate: MealEstimate) {
  return {
    calories: estimate.total_calories,
    protein: estimate.total_protein_g,
    carbs: estimate.total_carbs_g,
    fat: estimate.total_fat_g,
    confidence: estimate.confidence
  };
}
