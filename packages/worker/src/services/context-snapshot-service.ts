import { ContextSnapshot } from '../jobs/context-ingestion-job';

/**
 * Context Snapshot Service for storing ingested repository context
 * Implements B-604: Repository context ingestion job pipeline
 */

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

export class ContextSnapshotService {
  // In-memory storage for MVP - in production, this would use a database
  private snapshots: Map<string, ContextSnapshot[]> = new Map();

  /**
   * Save context snapshots for a project
   */
  async saveSnapshots(projectId: string, snapshots: ContextSnapshot[]): Promise<void> {
    console.log(`💾 Saving ${snapshots.length} context snapshots for project ${projectId}`);

    // Get existing snapshots for the project
    const existingSnapshots = this.snapshots.get(projectId) || [];

    // Remove any existing snapshots for the same file paths to avoid duplicates
    const newSnapshots = [...existingSnapshots];

    for (const newSnapshot of snapshots) {
      // Remove any existing snapshot for the same file path
      const existingIndex = newSnapshots.findIndex(
        s => s.source_file_path === newSnapshot.source_file_path
      );

      if (existingIndex >= 0) {
        console.log(`🔄 Updating existing snapshot for ${newSnapshot.source_file_path}`);
        newSnapshots[existingIndex] = newSnapshot;
      } else {
        console.log(`➕ Adding new snapshot for ${newSnapshot.source_file_path}`);
        newSnapshots.push(newSnapshot);
      }
    }

    // Store updated snapshots
    this.snapshots.set(projectId, newSnapshots);

    console.log(`✅ Saved ${snapshots.length} snapshots. Project now has ${newSnapshots.length} total snapshots.`);
  }

  /**
   * Get all snapshots for a project
   */
  async getSnapshots(projectId: string): Promise<ContextSnapshot[]> {
    return this.snapshots.get(projectId) || [];
  }

  /**
   * Get a specific snapshot by ID
   */
  async getSnapshot(projectId: string, snapshotId: string): Promise<ContextSnapshot | null> {
    const projectSnapshots = this.snapshots.get(projectId) || [];
    return projectSnapshots.find(s => s.id === snapshotId) || null;
  }

  /**
   * Get snapshots by source type
   */
  async getSnapshotsBySourceType(projectId: string, sourceTypeId: string): Promise<ContextSnapshot[]> {
    const projectSnapshots = this.snapshots.get(projectId) || [];
    return projectSnapshots.filter(s => s.source_type_id === sourceTypeId);
  }

  /**
   * Get snapshot summary for a project
   */
  async getSnapshotSummary(projectId: string): Promise<ContextSnapshotSummary | null> {
    const projectSnapshots = this.snapshots.get(projectId) || [];

    if (projectSnapshots.length === 0) {
      return null;
    }

    // Calculate source type statistics
    const sourceTypes: { [key: string]: { count: number; total_size: number } } = {};
    let totalSize = 0;
    let oldestSnapshot: Date | null = null;

    for (const snapshot of projectSnapshots) {
      // Update source type stats
      if (!sourceTypes[snapshot.source_type_id]) {
        sourceTypes[snapshot.source_type_id] = { count: 0, total_size: 0 };
      }
      sourceTypes[snapshot.source_type_id].count++;
      sourceTypes[snapshot.source_type_id].total_size += snapshot.file_size;

      // Update totals
      totalSize += snapshot.file_size;

      // Track oldest snapshot
      if (!oldestSnapshot || snapshot.ingested_at < oldestSnapshot) {
        oldestSnapshot = snapshot.ingested_at;
      }
    }

    return {
      project_id: projectId,
      total_snapshots: projectSnapshots.length,
      total_size: totalSize,
      created_at: oldestSnapshot || new Date(),
      source_types: sourceTypes
    };
  }

  /**
   * Delete snapshots for a project
   */
  async deleteProjectSnapshots(projectId: string): Promise<number> {
    const projectSnapshots = this.snapshots.get(projectId) || [];
    const count = projectSnapshots.length;

    this.snapshots.delete(projectId);

    console.log(`🗑️ Deleted ${count} snapshots for project ${projectId}`);
    return count;
  }

  /**
   * Delete a specific snapshot
   */
  async deleteSnapshot(projectId: string, snapshotId: string): Promise<boolean> {
    const projectSnapshots = this.snapshots.get(projectId) || [];
    const index = projectSnapshots.findIndex(s => s.id === snapshotId);

    if (index >= 0) {
      projectSnapshots.splice(index, 1);
      this.snapshots.set(projectId, projectSnapshots);
      console.log(`🗑️ Deleted snapshot ${snapshotId} from project ${projectId}`);
      return true;
    }

    return false;
  }

  /**
   * Search snapshots by content
   */
  async searchSnapshots(projectId: string, query: string, limit = 10): Promise<ContextSnapshot[]> {
    const projectSnapshots = this.snapshots.get(projectId) || [];
    const lowercaseQuery = query.toLowerCase();

    return projectSnapshots
      .filter(snapshot =>
        snapshot.content_text.toLowerCase().includes(lowercaseQuery) ||
        snapshot.source_file_path.toLowerCase().includes(lowercaseQuery)
      )
      .slice(0, limit);
  }

  /**
   * Get storage statistics across all projects
   */
  async getGlobalStatistics(): Promise<{
    total_projects: number;
    total_snapshots: number;
    total_size: number;
    projects_by_snapshot_count: { project_id: string; count: number }[];
  }> {
    let totalSnapshots = 0;
    let totalSize = 0;
    const projectStats: { project_id: string; count: number }[] = [];

    for (const [projectId, snapshots] of this.snapshots.entries()) {
      totalSnapshots += snapshots.length;
      projectStats.push({ project_id: projectId, count: snapshots.length });

      for (const snapshot of snapshots) {
        totalSize += snapshot.file_size;
      }
    }

    // Sort projects by snapshot count
    projectStats.sort((a, b) => b.count - a.count);

    return {
      total_projects: this.snapshots.size,
      total_snapshots: totalSnapshots,
      total_size: totalSize,
      projects_by_snapshot_count: projectStats
    };
  }

  /**
   * Clean up old snapshots (for maintenance)
   */
  async cleanupOldSnapshots(olderThanDays: number = 30): Promise<number> {
    const cutoffDate = new Date(Date.now() - (olderThanDays * 24 * 60 * 60 * 1000));
    let deletedCount = 0;

    for (const [projectId, snapshots] of this.snapshots.entries()) {
      const filteredSnapshots = snapshots.filter(s => s.ingested_at > cutoffDate);
      const removedCount = snapshots.length - filteredSnapshots.length;

      if (removedCount > 0) {
        this.snapshots.set(projectId, filteredSnapshots);
        deletedCount += removedCount;
        console.log(`🧹 Cleaned up ${removedCount} old snapshots from project ${projectId}`);
      }
    }

    if (deletedCount > 0) {
      console.log(`🧹 Total cleanup: removed ${deletedCount} snapshots older than ${olderThanDays} days`);
    }

    return deletedCount;
  }
}