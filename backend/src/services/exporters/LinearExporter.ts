import { IExporter, ExportResult } from '../ExportService';
import { Requirement, LinearExportConfig } from '../../models/types';

/**
 * Linear Issues Exporter (placeholder for future implementation)
 * Currently not implemented - focused on GitHub export (B-505)
 */
export class LinearExporter implements IExporter {
  async exportRequirement(requirement: Requirement, config: LinearExportConfig): Promise<ExportResult> {
    // TODO: Implement Linear export
    return {
      success: false,
      error: 'Linear export not yet implemented'
    };
  }

  async validateConfig(config: any): Promise<{ valid: boolean; error?: string }> {
    // TODO: Implement Linear config validation
    return {
      valid: false,
      error: 'Linear export not yet implemented'
    };
  }
}