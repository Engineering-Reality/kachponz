import { MigrationBuilder } from 'node-pg-migrate';

/**
 * Normalizes legacy tool commands in the tools table.
 * 1. Converts flat string args (e.g. "npx -y ...") into structured { command: "npx", args: ["-y", "..."] }
 * 2. Normalizes hardcoded local paths for amadeus-mcp and mcp-uipath into their npx equivalents
 * 3. Changes method to 'stdio' for standard npx tools that don't support SSE natively
 */
export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    DO $$
    DECLARE
      r RECORD;
      v_versions JSONB;
      v_release JSONB;
      v_args JSONB;
      v_command TEXT;
      v_method TEXT;
      v_idx INT;
      v_args_text TEXT;
    BEGIN
      FOR r IN SELECT tool_id, name, versions FROM tools LOOP
        v_versions := r.versions;
        IF v_versions IS NULL OR jsonb_array_length(v_versions) = 0 THEN CONTINUE; END IF;

        v_idx := jsonb_array_length(v_versions) - 1;
        v_release := v_versions -> v_idx -> 'released';
        IF v_release IS NULL THEN CONTINUE; END IF;

        v_args := v_release -> 'args';
        v_command := v_release ->> 'command';
        v_method := v_release ->> 'method';
        
        -- Default: keep existing
        v_args_text := '';

        -- If args is a string (legacy flat string format)
        IF jsonb_typeof(v_args) = 'string' THEN
          v_args_text := v_args#>>'{}';
          
          IF v_args_text LIKE '%@modelcontextprotocol/%' OR v_args_text LIKE '%google-mcp%' OR v_args_text LIKE '%linear-mcp-server%' THEN
            -- Normalize standard npx tools
            v_release := jsonb_set(v_release, '{command}', '"npx"');
            
            -- Re-construct args array (e.g. "npx -y @modelcontextprotocol/server-github" -> ["-y", "@modelcontextprotocol/server-github"])
            -- Simple split for our known packages
            IF v_args_text LIKE '%-y %' THEN
               v_release := jsonb_set(v_release, '{args}', jsonb_build_array('-y', split_part(v_args_text, '-y ', 2)));
            ELSE
               -- If just "npx package", skip the npx part
               v_release := jsonb_set(v_release, '{args}', jsonb_build_array(split_part(v_args_text, 'npx ', 2)));
            END IF;
            
            -- These are stdio tools, they don't run their own SSE server
            v_release := jsonb_set(v_release, '{method}', '"stdio"');
          
          ELSIF v_args_text LIKE '%amadeus-mcp/build/index.js%' THEN
            v_release := jsonb_set(v_release, '{command}', '"npx"');
            v_release := jsonb_set(v_release, '{args}', '["-y", "amadeus-mcp@latest"]'::jsonb);
            
          ELSIF v_args_text LIKE '%app_mcp_rag.py%' THEN
            -- Fix Supabase MCP python legacy string
            v_release := jsonb_set(v_release, '{command}', '"python"');
            v_release := jsonb_set(v_release, '{args}', jsonb_build_array(split_part(v_args_text, 'python ', 2)));
          END IF;
          
        -- If args is an array, check if it's the legacy local path for UiPath/Amadeus
        ELSIF jsonb_typeof(v_args) = 'array' THEN
          IF jsonb_array_length(v_args) > 0 THEN
            v_args_text := v_args ->> 0;
            IF v_args_text LIKE '%mcp-uipath/build/index.js%' THEN
              v_release := jsonb_set(v_release, '{command}', '"npx"');
              v_release := jsonb_set(v_release, '{args}', '["-y", "amadeus-uipath-mcp@latest"]'::jsonb);
            ELSIF v_args_text LIKE '%amadeus-mcp/build/index.js%' THEN
              v_release := jsonb_set(v_release, '{command}', '"npx"');
              v_release := jsonb_set(v_release, '{args}', '["-y", "amadeus-mcp@latest"]'::jsonb);
            END IF;
          END IF;
        END IF;

        -- Update the specific version
        v_versions := jsonb_set(v_versions, ARRAY[v_idx::text, 'released'], v_release);
        
        -- Save back to table
        UPDATE tools SET versions = v_versions WHERE tool_id = r.tool_id;
        RAISE NOTICE 'Normalized legacy command for tool %', r.name;
      END LOOP;
    END $$;
  `);
}

export async function down(_pgm: MigrationBuilder): Promise<void> {
  // Irreversible normalization
}
