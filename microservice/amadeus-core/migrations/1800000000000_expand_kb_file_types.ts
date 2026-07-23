import type { MigrationBuilder } from 'node-pg-migrate';

export async function up(pgm: MigrationBuilder): Promise<void> {
  // Drop the existing check constraint on kb_documents
  pgm.dropConstraint('kb_documents', 'kb_documents_file_type_check');

  // Add the new check constraint supporting 'excel' and 'word'
  pgm.addConstraint('kb_documents', 'kb_documents_file_type_check', {
    check: "file_type IN ('pdf', 'image', 'txt', 'excel', 'word')"
  });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  // In a rollback, remove the new constraint and restore the old one
  pgm.dropConstraint('kb_documents', 'kb_documents_file_type_check');
  pgm.addConstraint('kb_documents', 'kb_documents_file_type_check', {
    check: "file_type IN ('pdf', 'image', 'txt')"
  });
}
