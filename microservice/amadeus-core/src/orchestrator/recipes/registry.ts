import type { RecipeDef } from './types.js';
import { danantaraSurveyLoopRecipe } from './danantaraSurveyLoop.js';

const recipesById = new Map<string, RecipeDef>([
  [danantaraSurveyLoopRecipe.id, danantaraSurveyLoopRecipe],
]);

export function getRecipeById(recipeId: string): RecipeDef | undefined {
  return recipesById.get(recipeId);
}
