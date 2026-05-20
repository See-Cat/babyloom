import Database from 'better-sqlite3';

export function sanitize(snapshotDbPath: string) {
  const db = new Database(snapshotDbPath);
  try {
    db.pragma('foreign_keys = ON');
    db.transaction(() => {
      db.exec(`
        DELETE FROM entry_milestones
        WHERE entry_id IN (SELECT id FROM entries WHERE status != 'active');

        DELETE FROM entry_media
        WHERE entry_id IN (SELECT id FROM entries WHERE status != 'active')
           OR media_id IN (SELECT id FROM media WHERE status != 'ready');

        DELETE FROM entries WHERE status != 'active';

        DELETE FROM entry_media
        WHERE media_id IN (SELECT id FROM media WHERE status != 'ready');

        DELETE FROM media WHERE status != 'ready';

        DELETE FROM baby_member_permissions
        WHERE baby_id IN (SELECT id FROM babies WHERE status != 'active');

        DELETE FROM entries
        WHERE baby_id IN (SELECT id FROM babies WHERE status != 'active');

        DELETE FROM media
        WHERE baby_id IN (SELECT id FROM babies WHERE status != 'active');

        DELETE FROM babies WHERE status != 'active';

        DELETE FROM session;

        UPDATE babies SET deleted_at = NULL, deleted_by = NULL;
        UPDATE entries SET deleted_at = NULL, deleted_by = NULL;
        UPDATE media SET deleted_at = NULL, deleted_by = NULL;
      `);
    })();
  } finally {
    db.close();
  }
}
