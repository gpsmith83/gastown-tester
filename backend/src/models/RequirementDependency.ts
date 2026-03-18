import { db } from '../config/database';
import { RequirementDependency, RequirementDependencyWithDetails } from './types';

export class RequirementDependencyModel {
  // Create a dependency relationship
  static async create(
    requirement_id: string, // the requirement that is blocked
    dependency_id: string,  // the requirement that blocks it
    dependency_type: 'blocks' | 'relates_to' | 'duplicate_of',
    created_by: string
  ): Promise<RequirementDependency> {
    // Prevent circular dependencies for "blocks" relationships
    if (dependency_type === 'blocks') {
      const hasCircular = await this.checkCircularDependency(requirement_id, dependency_id);
      if (hasCircular) {
        throw new Error('This would create a circular dependency');
      }
    }

    // Prevent self-referencing dependencies
    if (requirement_id === dependency_id) {
      throw new Error('A requirement cannot depend on itself');
    }

    const result = await db.query(
      `INSERT INTO requirement_dependencies (
        requirement_id, dependency_id, dependency_type, created_by
      )
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (requirement_id, dependency_id, dependency_type)
       DO UPDATE SET created_by = $4, created_at = NOW()
       RETURNING *`,
      [requirement_id, dependency_id, dependency_type, created_by]
    );

    return result.rows[0];
  }

  // Remove a dependency relationship
  static async remove(
    requirement_id: string,
    dependency_id: string,
    dependency_type?: 'blocks' | 'relates_to' | 'duplicate_of'
  ): Promise<boolean> {
    const typeCondition = dependency_type ? 'AND dependency_type = $3' : '';
    const params = dependency_type
      ? [requirement_id, dependency_id, dependency_type]
      : [requirement_id, dependency_id];

    const result = await db.query(
      `DELETE FROM requirement_dependencies
       WHERE requirement_id = $1 AND dependency_id = $2 ${typeCondition}`,
      params
    );

    return (result.rowCount ?? 0) > 0;
  }

  // Get dependency by ID
  static async findById(id: string): Promise<RequirementDependency | null> {
    const result = await db.query(
      'SELECT * FROM requirement_dependencies WHERE id = $1',
      [id]
    );

    return result.rows[0] || null;
  }

  // Get all dependencies for a requirement (things that block this requirement)
  static async findByRequirementId(requirement_id: string): Promise<RequirementDependencyWithDetails[]> {
    const result = await db.query(
      `SELECT rd.*,
              JSON_BUILD_OBJECT(
                'id', r.id,
                'title', r.title,
                'description', r.description,
                'status', r.status,
                'priority', r.priority,
                'type', r.type,
                'created_at', r.created_at,
                'updated_at', r.updated_at
              ) as dependency,
              JSON_BUILD_OBJECT(
                'id', u.id,
                'username', u.username,
                'email', u.email,
                'name', u.name,
                'avatar_url', u.avatar_url
              ) as created_by_user
       FROM requirement_dependencies rd
       INNER JOIN requirements r ON rd.dependency_id = r.id
       INNER JOIN users u ON rd.created_by = u.id
       WHERE rd.requirement_id = $1 AND r.is_active = true
       ORDER BY rd.created_at ASC`,
      [requirement_id]
    );

    return result.rows;
  }

  // Get all requirements that depend on this one (things this requirement blocks)
  static async findBlockedBy(requirement_id: string): Promise<RequirementDependencyWithDetails[]> {
    const result = await db.query(
      `SELECT rd.*,
              JSON_BUILD_OBJECT(
                'id', r.id,
                'title', r.title,
                'description', r.description,
                'status', r.status,
                'priority', r.priority,
                'type', r.type,
                'created_at', r.created_at,
                'updated_at', r.updated_at
              ) as dependency,
              JSON_BUILD_OBJECT(
                'id', u.id,
                'username', u.username,
                'email', u.email,
                'name', u.name,
                'avatar_url', u.avatar_url
              ) as created_by_user
       FROM requirement_dependencies rd
       INNER JOIN requirements r ON rd.requirement_id = r.id
       INNER JOIN users u ON rd.created_by = u.id
       WHERE rd.dependency_id = $1 AND r.is_active = true
       ORDER BY rd.created_at ASC`,
      [requirement_id]
    );

    return result.rows;
  }

  // Check if requirement has any blocking dependencies (useful for workflow rules)
  static async hasBlockingDependencies(requirement_id: string): Promise<boolean> {
    const result = await db.query(
      `SELECT 1 FROM requirement_dependencies rd
       INNER JOIN requirements r ON rd.dependency_id = r.id
       WHERE rd.requirement_id = $1
         AND rd.dependency_type = 'blocks'
         AND r.status NOT IN ('completed', 'archived', 'cancelled')
         AND r.is_active = true`,
      [requirement_id]
    );

    return (result.rowCount ?? 0) > 0;
  }

  // Get all incomplete blocking dependencies
  static async getIncompleteBlockingDependencies(requirement_id: string): Promise<RequirementDependencyWithDetails[]> {
    const result = await db.query(
      `SELECT rd.*,
              JSON_BUILD_OBJECT(
                'id', r.id,
                'title', r.title,
                'description', r.description,
                'status', r.status,
                'priority', r.priority,
                'type', r.type,
                'created_at', r.created_at,
                'updated_at', r.updated_at
              ) as dependency,
              JSON_BUILD_OBJECT(
                'id', u.id,
                'username', u.username,
                'email', u.email,
                'name', u.name,
                'avatar_url', u.avatar_url
              ) as created_by_user
       FROM requirement_dependencies rd
       INNER JOIN requirements r ON rd.dependency_id = r.id
       INNER JOIN users u ON rd.created_by = u.id
       WHERE rd.requirement_id = $1
         AND rd.dependency_type = 'blocks'
         AND r.status NOT IN ('completed', 'archived', 'cancelled')
         AND r.is_active = true
       ORDER BY r.priority ASC, rd.created_at ASC`,
      [requirement_id]
    );

    return result.rows;
  }

  // Check for circular dependencies
  static async checkCircularDependency(requirement_id: string, dependency_id: string): Promise<boolean> {
    // Use recursive CTE to check if dependency_id eventually depends on requirement_id
    const result = await db.query(
      `WITH RECURSIVE dependency_chain AS (
        -- Base case: direct dependencies of the proposed dependency
        SELECT rd.requirement_id, rd.dependency_id, 1 as depth
        FROM requirement_dependencies rd
        WHERE rd.dependency_id = $1 AND rd.dependency_type = 'blocks'

        UNION ALL

        -- Recursive case: follow the chain
        SELECT rd.requirement_id, rd.dependency_id, dc.depth + 1
        FROM requirement_dependencies rd
        INNER JOIN dependency_chain dc ON rd.dependency_id = dc.requirement_id
        WHERE rd.dependency_type = 'blocks' AND dc.depth < 10 -- Prevent infinite loops
      )
      SELECT 1 FROM dependency_chain
      WHERE requirement_id = $2`,
      [dependency_id, requirement_id]
    );

    return (result.rowCount ?? 0) > 0;
  }

  // Get dependency graph for visualization
  static async getDependencyGraph(requirement_ids: string[]): Promise<any> {
    if (requirement_ids.length === 0) return { nodes: [], edges: [] };

    const placeholders = requirement_ids.map((_, i) => `$${i + 1}`).join(',');

    const result = await db.query(
      `SELECT rd.*,
              r1.title as requirement_title,
              r1.status as requirement_status,
              r2.title as dependency_title,
              r2.status as dependency_status
       FROM requirement_dependencies rd
       INNER JOIN requirements r1 ON rd.requirement_id = r1.id
       INNER JOIN requirements r2 ON rd.dependency_id = r2.id
       WHERE (rd.requirement_id IN (${placeholders}) OR rd.dependency_id IN (${placeholders}))
         AND r1.is_active = true AND r2.is_active = true
       ORDER BY rd.dependency_type, rd.created_at`,
      requirement_ids
    );

    // Transform into graph format
    const edges = result.rows;
    const nodeIds = new Set();

    edges.forEach(edge => {
      nodeIds.add(edge.requirement_id);
      nodeIds.add(edge.dependency_id);
    });

    const nodes = Array.from(nodeIds).map(id => {
      const edge = edges.find(e => e.requirement_id === id || e.dependency_id === id);
      return {
        id,
        title: edge?.requirement_id === id ? edge.requirement_title : edge.dependency_title,
        status: edge?.requirement_id === id ? edge.requirement_status : edge.dependency_status
      };
    });

    return { nodes, edges };
  }

  // Find all related requirements (dependencies and dependents)
  static async findAllRelated(requirement_id: string): Promise<{
    dependencies: RequirementDependencyWithDetails[],
    blocking: RequirementDependencyWithDetails[]
  }> {
    const [dependencies, blocking] = await Promise.all([
      this.findByRequirementId(requirement_id),
      this.findBlockedBy(requirement_id)
    ]);

    return { dependencies, blocking };
  }

  // Check if two requirements are related
  static async areRelated(requirement1_id: string, requirement2_id: string): Promise<boolean> {
    const result = await db.query(
      `SELECT 1 FROM requirement_dependencies
       WHERE (requirement_id = $1 AND dependency_id = $2)
          OR (requirement_id = $2 AND dependency_id = $1)`,
      [requirement1_id, requirement2_id]
    );

    return (result.rowCount ?? 0) > 0;
  }
}