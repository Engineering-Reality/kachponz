import type { RecipeDef } from './types.js';

/**
 * Data-only definition of the concrete Danantara disposable-email/login/OTP/
 * survey loop, ported to the generalized RecipeDef/RecipeStepDef shape
 * (creatoroop.md Step 1). `agentId` is intentionally left blank here — the
 * real Danantara agent's id is a Supabase-generated UUID not known at
 * code-authoring time; `scripts/seedDanantaraRecipe.ts` looks it up by name
 * and fills it in before persisting via `recipes/store.ts`.
 *
 * The `release` resolver reproduces the old resolveReleaseKeys/
 * parseProcessListText mechanism exactly (same regex, same one-time
 * list_uipath_processes call, same live rotation ceiling) — trigger_uipath_job
 * hard-requires a resolved releaseKey GUID, never a name, so this is not
 * optional for this recipe even though the generic schema makes it optional
 * in general.
 */
export const danantaraSurveyLoopRecipe: RecipeDef = {
  id: 'danantara_survey_loop',
  agentId: '',
  label: 'Danantara Survey Loop',
  resolvers: [
    {
      id: 'release',
      toolName: 'list_uipath_processes',
      argsTemplate: { folderId: '999269' },
      extract: {
        kind: 'text_lines',
        itemPattern: '^\\u2022\\s*(.+?)\\s*\\(key:\\s*([^)]+)\\)\\s*$',
        nameGroup: 1,
        valueGroup: 2,
      },
    },
  ],
  steps: [
    {
      id: 'get_email',
      label: 'Get disposable email',
      toolName: 'trigger_uipath_job',
      argsTemplate: { releaseKey: '{{resolved}}', folderId: '999269' },
      variantCount: 3,
      resolve: { resolverId: 'release', nameTemplate: 'Get_DisposableEmail_{{variant}}' },
      pollFor: {
        toolName: 'get_uipath_job_status',
        argsTemplate: { jobId: '{{prevStepOutput.jobId}}' },
        terminalField: 'state',
        terminalValues: ['Successful', 'Faulted', 'Stopped'],
        successValues: ['Successful'],
        timeoutSeconds: 120,
        pollIntervalSeconds: 5,
      },
      verify: {
        toolName: 'get_uipath_asset',
        argsTemplate: { assetName: 'TemptomailFlow_TempMail', folderId: '999269' },
        checkField: 'value',
        mustBeNonEmpty: true,
      },
      onFault: 'rotate_variant',
    },
    {
      id: 'login',
      label: 'Login',
      toolName: 'trigger_uipath_job',
      argsTemplate: { releaseKey: '{{resolved}}', folderId: '999269' },
      resolve: { resolverId: 'release', nameTemplate: 'Danantara_LoginFlow' },
      pollFor: {
        toolName: 'get_uipath_job_status',
        argsTemplate: { jobId: '{{prevStepOutput.jobId}}' },
        terminalField: 'state',
        terminalValues: ['Successful', 'Faulted', 'Stopped'],
        successValues: ['Successful'],
        timeoutSeconds: 120,
        pollIntervalSeconds: 5,
      },
      onFault: 'abort_iteration',
    },
    {
      id: 'get_otp',
      label: 'Get OTP',
      toolName: 'trigger_uipath_job',
      argsTemplate: { releaseKey: '{{resolved}}', folderId: '999269' },
      variantCount: 3,
      resolve: { resolverId: 'release', nameTemplate: 'Get_OTP_Email_{{variant}}' },
      pollFor: {
        toolName: 'get_uipath_job_status',
        argsTemplate: { jobId: '{{prevStepOutput.jobId}}' },
        terminalField: 'state',
        terminalValues: ['Successful', 'Faulted', 'Stopped'],
        successValues: ['Successful'],
        timeoutSeconds: 120,
        pollIntervalSeconds: 5,
      },
      verify: {
        toolName: 'get_uipath_asset',
        argsTemplate: { assetName: 'TemptomailFlow_OTP', folderId: '999269' },
        checkField: 'value',
        mustBeNonEmpty: true,
      },
      onFault: 'abort_iteration',
    },
    {
      id: 'input_otp_and_survey',
      label: 'Input OTP & survey',
      toolName: 'trigger_uipath_job',
      argsTemplate: { releaseKey: '{{resolved}}', folderId: '999269' },
      resolve: { resolverId: 'release', nameTemplate: 'Danantara_InputOTPFlow' },
      pollFor: {
        toolName: 'get_uipath_job_status',
        argsTemplate: { jobId: '{{prevStepOutput.jobId}}' },
        terminalField: 'state',
        terminalValues: ['Successful', 'Faulted', 'Stopped'],
        successValues: ['Successful'],
        timeoutSeconds: 180,
        pollIntervalSeconds: 5,
      },
      onFault: 'abort_iteration',
    },
  ],
  iterations: 3,
  maxConcurrentJobs: 1,
};
