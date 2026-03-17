import { db } from '../config/database';
import {
  LinearConnection,
  CreateLinearConnectionRequest,
  UpdateLinearConnectionRequest,
  LinearConnectionValidationResult
} from './types';
import * as crypto from 'crypto';

export class LinearConnectionModel {

  // Hash API token for secure storage
  private static hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  // Create a new Linear connection for a project
  static async create(
    project_id: string,
    data: CreateLinearConnectionRequest
  ): Promise<LinearConnection> {
    const token_hash = this.hashToken(data.api_token);

    const result = await db.query(
      `INSERT INTO linear_connections (
        project_id, api_token_hash, workspace_id, team_id,
        board_id, project_id_linear
      )
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        project_id,
        token_hash,
        data.workspace_id,
        data.team_id,
        data.board_id || null,
        data.project_id_linear || null
      ]
    );

    return result.rows[0];
  }

  // Get Linear connection by project ID
  static async findByProjectId(project_id: string): Promise<LinearConnection | null> {
    const result = await db.query(
      'SELECT * FROM linear_connections WHERE project_id = $1',
      [project_id]
    );

    return result.rows[0] || null;
  }

  // Update Linear connection
  static async update(
    project_id: string,
    data: UpdateLinearConnectionRequest
  ): Promise<LinearConnection | null> {
    const fields = [];
    const values = [];
    let paramIndex = 1;

    if (data.workspace_id !== undefined) {
      fields.push(`workspace_id = $${paramIndex++}`);
      values.push(data.workspace_id);
    }

    if (data.team_id !== undefined) {
      fields.push(`team_id = $${paramIndex++}`);
      values.push(data.team_id);
    }

    if (data.board_id !== undefined) {
      fields.push(`board_id = $${paramIndex++}`);
      values.push(data.board_id);
    }

    if (data.project_id_linear !== undefined) {
      fields.push(`project_id_linear = $${paramIndex++}`);
      values.push(data.project_id_linear);
    }

    if (fields.length === 0) {
      return this.findByProjectId(project_id);
    }

    values.push(project_id);

    const result = await db.query(
      `UPDATE linear_connections
       SET ${fields.join(', ')}, updated_at = NOW()
       WHERE project_id = $${paramIndex}
       RETURNING *`,
      values
    );

    return result.rows[0] || null;
  }

  // Update validation status
  static async updateValidation(
    project_id: string,
    validation_result: LinearConnectionValidationResult
  ): Promise<LinearConnection | null> {
    const result = await db.query(
      `UPDATE linear_connections SET
        is_validated = $1,
        validation_error = $2,
        last_validated_at = NOW(),
        workspace_name = $3,
        team_name = $4,
        board_name = $5,
        project_name_linear = $6,
        linear_organization_id = $7,
        linear_organization_name = $8,
        permissions = $9,
        updated_at = NOW()
       WHERE project_id = $10
       RETURNING *`,
      [
        validation_result.is_valid,
        validation_result.error || null,
        validation_result.workspace?.name || null,
        validation_result.team?.name || null,
        validation_result.board?.name || null,
        validation_result.project?.name || null,
        validation_result.organization?.id || null,
        validation_result.organization?.name || null,
        JSON.stringify(validation_result.permissions || []),
        project_id
      ]
    );

    return result.rows[0] || null;
  }

  // Delete Linear connection
  static async delete(project_id: string): Promise<boolean> {
    const result = await db.query(
      'DELETE FROM linear_connections WHERE project_id = $1',
      [project_id]
    );

    return (result.rowCount ?? 0) > 0;
  }

  // Check if API token matches stored hash
  static async verifyToken(project_id: string, token: string): Promise<boolean> {
    const connection = await this.findByProjectId(project_id);
    if (!connection) return false;

    const token_hash = this.hashToken(token);
    return connection.api_token_hash === token_hash;
  }

  // Get all validated Linear connections
  static async findValidated(): Promise<LinearConnection[]> {
    const result = await db.query(
      'SELECT * FROM linear_connections WHERE is_validated = TRUE ORDER BY updated_at DESC'
    );

    return result.rows;
  }

  // Get connections needing validation (older than 24 hours or never validated)
  static async findNeedingValidation(): Promise<LinearConnection[]> {
    const result = await db.query(
      `SELECT * FROM linear_connections
       WHERE is_validated = FALSE
       OR last_validated_at IS NULL
       OR last_validated_at < NOW() - INTERVAL '24 hours'
       ORDER BY updated_at ASC`
    );

    return result.rows;
  }
}