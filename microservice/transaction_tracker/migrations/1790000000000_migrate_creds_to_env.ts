import { MigrationBuilder } from 'node-pg-migrate';

/**
 * Migrates UiPath credentials from the args JSON blob to the env field.
 * After this migration, credentials are stored as environment variables
 * (UIPATH_CLIENT_ID, etc.) in the release.env object, and the JSON blob
 * is removed from args.
 */
export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    DO $$
    DECLARE
      r RECORD;
      v_versions JSONB;
      v_release JSONB;
      v_args JSONB;
      v_env JSONB;
      v_creds_arg TEXT;
      v_creds JSONB;
      v_new_args JSONB;
      v_new_env JSONB;
      v_idx INT;
    BEGIN
      FOR r IN SELECT tool_id, versions FROM tools LOOP
        v_versions := r.versions;
        IF v_versions IS NULL OR jsonb_array_length(v_versions) = 0 THEN CONTINUE; END IF;

        v_idx := jsonb_array_length(v_versions) - 1;
        v_release := v_versions -> v_idx -> 'released';
        IF v_release IS NULL THEN CONTINUE; END IF;

        v_env := COALESCE(v_release -> 'env', '{}'::jsonb);
        -- Skip if env already has credentials
        IF v_env ? 'UIPATH_CLIENT_ID' THEN CONTINUE; END IF;

        v_args := v_release -> 'args';
        IF v_args IS NULL OR jsonb_typeof(v_args) != 'array' THEN CONTINUE; END IF;

        -- Find the args element that looks like a JSON credentials blob
        v_creds_arg := NULL;
        FOR i IN 0..jsonb_array_length(v_args)-1 LOOP
          IF jsonb_typeof(v_args -> i) = 'string'
             AND (v_args ->> i) LIKE '{%"clientId"%'
          THEN
            v_creds_arg := v_args ->> i;
            -- Build new args without this element
            v_new_args := '[]'::jsonb;
            FOR j IN 0..jsonb_array_length(v_args)-1 LOOP
              IF j != i THEN
                v_new_args := v_new_args || jsonb_build_array(v_args -> j);
              END IF;
            END LOOP;
            EXIT;
          END IF;
        END LOOP;

        IF v_creds_arg IS NULL THEN CONTINUE; END IF;

        BEGIN
          v_creds := v_creds_arg::jsonb;
        EXCEPTION WHEN OTHERS THEN
          CONTINUE; -- not valid JSON, skip
        END;

        -- Build the new env with credential fields
        v_new_env := v_env
          || jsonb_build_object('UIPATH_BASE_URL', COALESCE(v_creds ->> 'baseUrl', 'https://cloud.uipath.com'))
          || jsonb_build_object('UIPATH_ORG', v_creds ->> 'org')
          || jsonb_build_object('UIPATH_TENANT', v_creds ->> 'tenant')
          || jsonb_build_object('UIPATH_CLIENT_ID', v_creds ->> 'clientId')
          || jsonb_build_object('UIPATH_CLIENT_SECRET', v_creds ->> 'clientSecret')
          || jsonb_build_object('UIPATH_FOLDER_ID', COALESCE(v_creds ->> 'folderId', '0'))
          || jsonb_build_object('UIPATH_SCOPES', COALESCE(v_creds ->> 'scopes', 'OR.Jobs OR.Robots.Read OR.Execution OR.Queues OR.Monitoring'));

        -- Update the release object: new env, cleaned args
        v_release := v_release
          || jsonb_build_object('env', v_new_env)
          || jsonb_build_object('args', v_new_args);

        v_versions := jsonb_set(v_versions, ARRAY[v_idx::text, 'released'], v_release);

        UPDATE tools SET versions = v_versions WHERE tool_id = r.tool_id;
        RAISE NOTICE 'Migrated credentials for tool %', r.tool_id;
      END LOOP;
    END $$;
  `);
}

export async function down(_pgm: MigrationBuilder): Promise<void> {
  // No-op: we don't un-migrate credentials back into args.
  // The legacy fallback path in extractCredentialsFromToolRow handles both formats.
}
