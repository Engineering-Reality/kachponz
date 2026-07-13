import type { RecipeDef } from './types.js';

/**
 * Data-only definition of the concrete Danantara disposable-email/login/OTP/
 * survey loop. `maxVariants` here is just the upper bound the resolver probes
 * for at run start (Step 2 in loop.md) — the transcript this recipe fixes
 * showed only `_1`/`_2` actually existed in UiPath despite `_3` being assumed
 * elsewhere, so the real ceiling always comes from a live
 * `list_uipath_processes` call, never from this constant.
 */
export const danantaraSurveyLoopRecipe: RecipeDef = {
  id: 'danantara_survey_loop',
  folderId: '999269',
  maxVariants: 3,
  steps: [
    {
      id: 'get_email',
      releaseName: 'Get_DisposableEmail',
      variantParam: 'email',
      waitTimeoutSeconds: 120,
      onFault: 'rotate_variant',
      verifyAsset: { assetName: 'TemptomailFlow_TempMail', mustBeNonEmpty: true },
    },
    {
      id: 'login',
      releaseName: 'Danantara_LoginFlow',
      waitTimeoutSeconds: 120,
      onFault: 'abort_iteration',
    },
    {
      id: 'get_otp',
      releaseName: 'Get_OTP_Email',
      variantParam: 'otp',
      waitTimeoutSeconds: 120,
      onFault: 'abort_iteration',
      verifyAsset: { assetName: 'TemptomailFlow_OTP', mustBeNonEmpty: true },
    },
    {
      id: 'input_otp_and_survey',
      releaseName: 'Danantara_InputOTPFlow',
      waitTimeoutSeconds: 180,
      onFault: 'abort_iteration',
    },
  ],
  iterations: 3,
  maxConcurrentJobs: 1,
};
