import { db } from '../config/database';
import { RequirementWatcher, RequirementWatcherWithUser } from './types';

export class RequirementWatcherModel {
  // Add a watcher to a requirement
  static async addWatcher(
    requirement_id: string,
    user_id: string,
    watch_type: 'all' | 'mentions' | 'status_changes' = 'all'
  ): Promise<RequirementWatcher> {
    // Use INSERT ... ON CONFLICT to handle duplicates
    const result = await db.query(
      `INSERT INTO requirement_watchers (requirement_id, user_id, watch_type)
       VALUES ($1, $2, $3)
       ON CONFLICT (requirement_id, user_id)
       DO UPDATE SET watch_type = $3, created_at = NOW()
       RETURNING *`,
      [requirement_id, user_id, watch_type]
    );

    return result.rows[0];
  }

  // Remove a watcher from a requirement
  static async removeWatcher(requirement_id: string, user_id: string): Promise<boolean> {
    const result = await db.query(
      'DELETE FROM requirement_watchers WHERE requirement_id = $1 AND user_id = $2',
      [requirement_id, user_id]
    );

    return (result.rowCount ?? 0) > 0;
  }

  // Get watcher by ID
  static async findById(id: string): Promise<RequirementWatcher | null> {
    const result = await db.query(
      'SELECT * FROM requirement_watchers WHERE id = $1',
      [id]
    );

    return result.rows[0] || null;
  }

  // Get all watchers for a requirement
  static async findByRequirementId(requirement_id: string): Promise<RequirementWatcherWithUser[]> {
    const result = await db.query(
      `SELECT rw.*,
              JSON_BUILD_OBJECT(
                'id', u.id,
                'username', u.username,
                'email', u.email,
                'name', u.name,
                'avatar_url', u.avatar_url
              ) as user
       FROM requirement_watchers rw
       INNER JOIN users u ON rw.user_id = u.id
       WHERE rw.requirement_id = $1
       ORDER BY rw.created_at ASC`,
      [requirement_id]
    );

    return result.rows;
  }

  // Get all requirements a user is watching
  static async findByUserId(user_id: string): Promise<RequirementWatcherWithUser[]> {
    const result = await db.query(
      `SELECT rw.*,
              JSON_BUILD_OBJECT(
                'id', u.id,
                'username', u.username,
                'email', u.email,
                'name', u.name,
                'avatar_url', u.avatar_url
              ) as user,
              r.title as requirement_title,
              r.status as requirement_status,
              r.priority as requirement_priority
       FROM requirement_watchers rw
       INNER JOIN users u ON rw.user_id = u.id
       INNER JOIN requirements r ON rw.requirement_id = r.id
       WHERE rw.user_id = $1 AND r.is_active = true
       ORDER BY r.updated_at DESC`,
      [user_id]
    );

    return result.rows;
  }

  // Check if user is watching a requirement
  static async isWatching(requirement_id: string, user_id: string): Promise<boolean> {
    const result = await db.query(
      'SELECT 1 FROM requirement_watchers WHERE requirement_id = $1 AND user_id = $2',
      [requirement_id, user_id]
    );

    return (result.rowCount ?? 0) > 0;
  }

  // Get users who should be notified for a specific event type
  static async getNotificationRecipients(
    requirement_id: string,
    event_type: 'all' | 'mentions' | 'status_changes'
  ): Promise<string[]> {
    let watchTypeCondition = '';

    if (event_type === 'mentions') {
      watchTypeCondition = "AND (rw.watch_type = 'all' OR rw.watch_type = 'mentions')";
    } else if (event_type === 'status_changes') {
      watchTypeCondition = "AND (rw.watch_type = 'all' OR rw.watch_type = 'status_changes')";
    } else {
      watchTypeCondition = "AND rw.watch_type = 'all'";
    }

    const result = await db.query(
      `SELECT DISTINCT rw.user_id
       FROM requirement_watchers rw
       WHERE rw.requirement_id = $1 ${watchTypeCondition}`,
      [requirement_id]
    );

    return result.rows.map(row => row.user_id);
  }

  // Auto-add watchers when requirement is created
  static async autoAddWatchers(requirement_id: string): Promise<void> {
    // Auto-watch: author, assignee (if any), project owner
    await db.query(
      `INSERT INTO requirement_watchers (requirement_id, user_id, watch_type)
       SELECT $1, r.author_id, 'all'
       FROM requirements r
       WHERE r.id = $1
       ON CONFLICT (requirement_id, user_id) DO NOTHING`,
      [requirement_id]
    );

    // Auto-watch assignee if different from author
    await db.query(
      `INSERT INTO requirement_watchers (requirement_id, user_id, watch_type)
       SELECT $1, r.assignee_id, 'all'
       FROM requirements r
       WHERE r.id = $1 AND r.assignee_id IS NOT NULL
         AND r.assignee_id != r.author_id
       ON CONFLICT (requirement_id, user_id) DO NOTHING`,
      [requirement_id]
    );

    // Auto-watch project owner if different from author and assignee
    await db.query(
      `INSERT INTO requirement_watchers (requirement_id, user_id, watch_type)
       SELECT $1, p.owner_id, 'all'
       FROM requirements r
       INNER JOIN projects p ON r.project_id = p.id
       WHERE r.id = $1 AND p.owner_id != r.author_id
         AND (r.assignee_id IS NULL OR p.owner_id != r.assignee_id)
       ON CONFLICT (requirement_id, user_id) DO NOTHING`,
      [requirement_id]
    );
  }

  // Update watch type for existing watcher
  static async updateWatchType(
    requirement_id: string,
    user_id: string,
    watch_type: 'all' | 'mentions' | 'status_changes'
  ): Promise<RequirementWatcher | null> {
    const result = await db.query(
      `UPDATE requirement_watchers
       SET watch_type = $1
       WHERE requirement_id = $2 AND user_id = $3
       RETURNING *`,
      [watch_type, requirement_id, user_id]
    );

    return result.rows[0] || null;
  }

  // Bulk add watchers (useful for mentions or team assignments)
  static async addWatchers(
    requirement_id: string,
    user_ids: string[],
    watch_type: 'all' | 'mentions' | 'status_changes' = 'all'
  ): Promise<RequirementWatcher[]> {
    if (user_ids.length === 0) return [];

    const values = user_ids.map((user_id, index) =>
      `($1, $${index + 2}, $${user_ids.length + 2})`
    ).join(', ');

    const result = await db.query(
      `INSERT INTO requirement_watchers (requirement_id, user_id, watch_type)
       VALUES ${values}
       ON CONFLICT (requirement_id, user_id)
       DO UPDATE SET watch_type = $${user_ids.length + 2}
       RETURNING *`,
      [requirement_id, ...user_ids, watch_type]
    );

    return result.rows;
  }
}