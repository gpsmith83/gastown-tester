import { eq, and, desc, sql } from 'drizzle-orm';
import { db } from '../database/connection';
import { contextSnapshots, contextChanges, projects } from '../database/schema';

/**
 * Database-backed Context Snapshot Service for B-601: Repository context models and analysis
 * Replaces the in-memory implementation with PostgreSQL persistence
 */

export interface ContextSnapshot {
  id: string;
  project_id: string;
  source_file_path: string;
  source_type_id: string;
  content_text: string;
  content_hash: string;
  file_size: number;
  last_modified: Date;
  ingested_at: Date;
  ingestion_metadata: {
    github_repo_url: string;
    github_sha?: string;
    parsing_method: string;
    word_count: number;
    char_count: number;
  };
}

export interface ContextSnapshotSummary {
  project_id: string;
  total_snapshots: number;
  total_size: number;
  created_at: Date;
  source_types: {
    [source_type_id: string]: {
      count: number;
      total_size: number;
    };
  };
}

export interface ContextChange {
  id: string;
  snapshotId: string;
  projectId: string;
  changeType: 'created' | 'updated' | 'deleted';
  previousHash?: string;
  newHash?: string;
  changeMetadata?: any;
  detectedAt: Date;
}

export class ContextSnapshotDatabaseService {
  /**
   * Save context snapshots for a project
   */
  async saveSnapshots(projectId: string, snapshots: ContextSnapshot[]): Promise<void> {
    console.log(`💾 Saving ${snapshots.length} context snapshots for project ${projectId}`);

    try {
      for (const snapshot of snapshots) {
        // Check if snapshot already exists (by content hash)
        const existing = await db
          .select({ id: contextSnapshots.id })
          .from(contextSnapshots)
          .where(
            and(
              eq(contextSnapshots.projectId, projectId),
              eq(contextSnapshots.sourceFilePath, snapshot.source_file_path)
            )
          )
          .limit(1);

        if (existing.length > 0) {
          // Update existing snapshot
          const existingId = existing[0].id;
          await db
            .update(contextSnapshots)
            .set({
              contentText: snapshot.content_text,
              contentHash: snapshot.content_hash,
              fileSize: snapshot.file_size,
              lastModified: snapshot.last_modified,
              ingestedAt: snapshot.ingested_at,
              ingestionMetadata: snapshot.ingestion_metadata,
              updatedAt: new Date(),
            })
            .where(eq(contextSnapshots.id, existingId));

          // Record the change
          await this.recordContextChange({
            snapshotId: existingId,
            projectId,
            changeType: 'updated',
            newHash: snapshot.content_hash,
            changeMetadata: {
              previousSize: existing.length > 0 ? undefined : 0, // We'd need to fetch this properly
              newSize: snapshot.file_size,
              updatedAt: snapshot.ingested_at,
            },
          });

          console.log(`🔄 Updated existing snapshot for ${snapshot.source_file_path}`);
        } else {
          // Insert new snapshot
          const [insertedSnapshot] = await db
            .insert(contextSnapshots)
            .values({
              id: snapshot.id,
              projectId,
              sourceFilePath: snapshot.source_file_path,
              sourceTypeId: snapshot.source_type_id,
              contentText: snapshot.content_text,
              contentHash: snapshot.content_hash,
              fileSize: snapshot.file_size,
              lastModified: snapshot.last_modified,
              ingestedAt: snapshot.ingested_at,
              ingestionMetadata: snapshot.ingestion_metadata,
            })
            .returning({ id: contextSnapshots.id });

          // Record the creation
          await this.recordContextChange({
            snapshotId: insertedSnapshot.id,
            projectId,
            changeType: 'created',
            newHash: snapshot.content_hash,
            changeMetadata: {
              filePath: snapshot.source_file_path,
              sourceType: snapshot.source_type_id,
              size: snapshot.file_size,
            },
          });

          console.log(`➕ Added new snapshot for ${snapshot.source_file_path}`);
        }
      }

      console.log(`✅ Saved ${snapshots.length} snapshots for project ${projectId}`);
    } catch (error) {
      console.error(`❌ Error saving snapshots:`, error);
      throw error;
    }
  }

  /**
   * Get all snapshots for a project
   */
  async getSnapshots(projectId: string): Promise<ContextSnapshot[]> {
    try {
      const snapshots = await db
        .select()
        .from(contextSnapshots)
        .where(eq(contextSnapshots.projectId, projectId))
        .orderBy(desc(contextSnapshots.ingestedAt));

      return snapshots.map(this.mapDbToSnapshot);
    } catch (error) {
      console.error(`❌ Error fetching snapshots for project ${projectId}:`, error);
      throw error;
    }
  }

  /**
   * Get a specific snapshot by ID
   */
  async getSnapshot(projectId: string, snapshotId: string): Promise<ContextSnapshot | null> {
    try {
      const result = await db
        .select()
        .from(contextSnapshots)
        .where(
          and(
            eq(contextSnapshots.projectId, projectId),
            eq(contextSnapshots.id, snapshotId)
          )
        )
        .limit(1);

      return result.length > 0 ? this.mapDbToSnapshot(result[0]) : null;
    } catch (error) {
      console.error(`❌ Error fetching snapshot ${snapshotId}:`, error);
      throw error;
    }
  }

  /**
   * Get snapshots by source type
   */
  async getSnapshotsBySourceType(projectId: string, sourceTypeId: string): Promise<ContextSnapshot[]> {
    try {
      const snapshots = await db
        .select()
        .from(contextSnapshots)
        .where(
          and(
            eq(contextSnapshots.projectId, projectId),
            eq(contextSnapshots.sourceTypeId, sourceTypeId)
          )
        )
        .orderBy(desc(contextSnapshots.ingestedAt));

      return snapshots.map(this.mapDbToSnapshot);
    } catch (error) {
      console.error(`❌ Error fetching snapshots by source type:`, error);
      throw error;
    }
  }

  /**
   * Get snapshot summary for a project
   */
  async getSnapshotSummary(projectId: string): Promise<ContextSnapshotSummary | null> {
    try {
      // Get aggregate data
      const summary = await db
        .select({
          totalSnapshots: sql<number>`count(*)`,
          totalSize: sql<number>`sum(file_size)`,
          oldestCreated: sql<Date>`min(created_at)`,
        })
        .from(contextSnapshots)
        .where(eq(contextSnapshots.projectId, projectId));

      if (!summary[0] || summary[0].totalSnapshots === 0) {
        return null;
      }

      // Get source type breakdown
      const sourceTypeStats = await db
        .select({
          sourceTypeId: contextSnapshots.sourceTypeId,
          count: sql<number>`count(*)`,
          totalSize: sql<number>`sum(file_size)`,
        })
        .from(contextSnapshots)
        .where(eq(contextSnapshots.projectId, projectId))
        .groupBy(contextSnapshots.sourceTypeId);

      const sourceTypes: { [key: string]: { count: number; total_size: number } } = {};
      sourceTypeStats.forEach(stat => {
        sourceTypes[stat.sourceTypeId] = {
          count: stat.count,
          total_size: stat.totalSize,
        };
      });

      return {
        project_id: projectId,
        total_snapshots: summary[0].totalSnapshots,
        total_size: summary[0].totalSize || 0,
        created_at: summary[0].oldestCreated || new Date(),
        source_types: sourceTypes,
      };
    } catch (error) {
      console.error(`❌ Error generating snapshot summary:`, error);
      throw error;
    }
  }

  /**
   * Delete snapshots for a project
   */
  async deleteProjectSnapshots(projectId: string): Promise<number> {
    try {
      // First delete associated changes
      await db
        .delete(contextChanges)
        .where(eq(contextChanges.projectId, projectId));

      // Then delete snapshots and get count
      const result = await db
        .delete(contextSnapshots)
        .where(eq(contextSnapshots.projectId, projectId))
        .returning({ id: contextSnapshots.id });

      console.log(`🗑️ Deleted ${result.length} snapshots for project ${projectId}`);
      return result.length;
    } catch (error) {
      console.error(`❌ Error deleting project snapshots:`, error);
      throw error;
    }
  }

  /**
   * Delete a specific snapshot
   */
  async deleteSnapshot(projectId: string, snapshotId: string): Promise<boolean> {
    try {
      // Delete associated changes first
      await db
        .delete(contextChanges)
        .where(eq(contextChanges.snapshotId, snapshotId));

      // Delete the snapshot
      const result = await db
        .delete(contextSnapshots)
        .where(
          and(
            eq(contextSnapshots.projectId, projectId),
            eq(contextSnapshots.id, snapshotId)
          )
        )
        .returning({ id: contextSnapshots.id });

      if (result.length > 0) {
        console.log(`🗑️ Deleted snapshot ${snapshotId} from project ${projectId}`);
        return true;
      }
      return false;
    } catch (error) {
      console.error(`❌ Error deleting snapshot:`, error);
      throw error;
    }
  }

  /**
   * Search snapshots by content
   */
  async searchSnapshots(projectId: string, query: string, limit = 10): Promise<ContextSnapshot[]> {
    try {
      const snapshots = await db
        .select()
        .from(contextSnapshots)
        .where(
          and(
            eq(contextSnapshots.projectId, projectId),
            sql`(content_text ILIKE ${`%${query}%`} OR source_file_path ILIKE ${`%${query}%`})`
          )
        )
        .orderBy(desc(contextSnapshots.ingestedAt))
        .limit(limit);

      return snapshots.map(this.mapDbToSnapshot);
    } catch (error) {
      console.error(`❌ Error searching snapshots:`, error);
      throw error;
    }
  }

  /**
   * Get context changes for a snapshot
   */
  async getSnapshotChanges(snapshotId: string): Promise<ContextChange[]> {
    try {
      const changes = await db
        .select()
        .from(contextChanges)
        .where(eq(contextChanges.snapshotId, snapshotId))
        .orderBy(desc(contextChanges.detectedAt));

      return changes.map(change => ({
        id: change.id,
        snapshotId: change.snapshotId,
        projectId: change.projectId,
        changeType: change.changeType as 'created' | 'updated' | 'deleted',
        previousHash: change.previousHash || undefined,
        newHash: change.newHash || undefined,
        changeMetadata: change.changeMetadata,
        detectedAt: change.detectedAt,
      }));
    } catch (error) {
      console.error(`❌ Error fetching snapshot changes:`, error);
      throw error;
    }
  }

  /**
   * Record a context change
   */
  private async recordContextChange(change: Omit<ContextChange, 'id' | 'detectedAt'>): Promise<void> {
    try {
      await db.insert(contextChanges).values({
        snapshotId: change.snapshotId,
        projectId: change.projectId,
        changeType: change.changeType,
        previousHash: change.previousHash,
        newHash: change.newHash,
        changeMetadata: change.changeMetadata,
      });
    } catch (error) {
      console.error(`❌ Error recording context change:`, error);
      // Don't throw here - changes are nice-to-have but shouldn't break the main flow
    }
  }

  /**
   * Map database row to ContextSnapshot interface
   */
  private mapDbToSnapshot(dbRow: any): ContextSnapshot {
    return {
      id: dbRow.id,
      project_id: dbRow.projectId,
      source_file_path: dbRow.sourceFilePath,
      source_type_id: dbRow.sourceTypeId,
      content_text: dbRow.contentText,
      content_hash: dbRow.contentHash,
      file_size: dbRow.fileSize,
      last_modified: dbRow.lastModified,
      ingested_at: dbRow.ingestedAt,
      ingestion_metadata: dbRow.ingestionMetadata,
    };
  }

  /**
   * Get global statistics across all projects
   */
  async getGlobalStatistics(): Promise<{
    totalProjects: number;
    totalSnapshots: number;
    totalSize: number;
    projectsBySnapshotCount: { projectId: string; count: number }[];
  }> {
    try {
      // Get total statistics
      const totalStats = await db
        .select({
          totalSnapshots: sql<number>`count(*)`,
          totalSize: sql<number>`sum(file_size)`,
          totalProjects: sql<number>`count(distinct project_id)`,
        })
        .from(contextSnapshots);

      // Get project breakdown
      const projectStats = await db
        .select({
          projectId: contextSnapshots.projectId,
          count: sql<number>`count(*)`,
        })
        .from(contextSnapshots)
        .groupBy(contextSnapshots.projectId)
        .orderBy(sql`count(*) desc`);

      return {
        totalProjects: totalStats[0]?.totalProjects || 0,
        totalSnapshots: totalStats[0]?.totalSnapshots || 0,
        totalSize: totalStats[0]?.totalSize || 0,
        projectsBySnapshotCount: projectStats.map(stat => ({
          projectId: stat.projectId,
          count: stat.count,
        })),
      };
    } catch (error) {
      console.error(`❌ Error getting global statistics:`, error);
      throw error;
    }
  }

  /**
   * Clean up old snapshots (for maintenance)
   */
  async cleanupOldSnapshots(olderThanDays: number = 30): Promise<number> {
    try {
      const cutoffDate = new Date(Date.now() - (olderThanDays * 24 * 60 * 60 * 1000));

      // Get snapshots to delete
      const oldSnapshots = await db
        .select({ id: contextSnapshots.id })
        .from(contextSnapshots)
        .where(sql`created_at < ${cutoffDate}`);

      let deletedCount = 0;

      for (const snapshot of oldSnapshots) {
        // Delete changes first
        await db
          .delete(contextChanges)
          .where(eq(contextChanges.snapshotId, snapshot.id));

        // Delete snapshot
        await db
          .delete(contextSnapshots)
          .where(eq(contextSnapshots.id, snapshot.id));

        deletedCount++;
      }

      if (deletedCount > 0) {
        console.log(`🧹 Cleanup: removed ${deletedCount} snapshots older than ${olderThanDays} days`);
      }

      return deletedCount;
    } catch (error) {
      console.error(`❌ Error cleaning up old snapshots:`, error);
      throw error;
    }
  }
}