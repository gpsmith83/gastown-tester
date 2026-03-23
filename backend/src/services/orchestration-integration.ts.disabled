import { PersonaOrchestrationService } from './persona-orchestration-service';
import { TriggerOrchestrationRequest } from '../models/types';

/**
 * Integration service for triggering orchestration from various system events
 * This provides a clean interface for other services to trigger orchestration
 */
export class OrchestrationIntegration {
  /**
   * Trigger orchestration when a new requirement is created
   */
  static async onRequirementCreated(params: {
    requirement_id: string;
    status: string;
    created_by?: string;
    requirement_data?: any;
  }): Promise<void> {
    try {
      console.log(`[ORCHESTRATION] Triggering on requirement created: ${params.requirement_id}`);

      const triggerData: TriggerOrchestrationRequest = {
        trigger_event: 'requirement_created',
        requirement_id: params.requirement_id,
        trigger_data: {
          requirement_status: params.status,
          user_id: params.created_by,
          requirement_data: params.requirement_data
        }
      };

      await PersonaOrchestrationService.triggerOrchestration(triggerData);
    } catch (error) {
      console.error('[ORCHESTRATION] Error triggering on requirement created:', error);
      // Don't throw - orchestration failures shouldn't break the main flow
    }
  }

  /**
   * Trigger orchestration when a persona invocation is completed
   */
  static async onPersonaCompleted(params: {
    requirement_id: string;
    session_id: string;
    persona_type: string;
    invocation_id: string;
    contributed_dimensions?: any[];
    user_id?: string;
  }): Promise<void> {
    try {
      console.log(`[ORCHESTRATION] Triggering on persona completed: ${params.persona_type} for requirement ${params.requirement_id}`);

      const triggerData: TriggerOrchestrationRequest = {
        trigger_event: 'persona_completed',
        requirement_id: params.requirement_id,
        session_id: params.session_id,
        trigger_data: {
          persona_type: params.persona_type,
          invocation_id: params.invocation_id,
          contributed_dimensions: params.contributed_dimensions,
          user_id: params.user_id
        }
      };

      await PersonaOrchestrationService.triggerOrchestration(triggerData);
    } catch (error) {
      console.error('[ORCHESTRATION] Error triggering on persona completed:', error);
      // Don't throw - orchestration failures shouldn't break the main flow
    }
  }

  /**
   * Trigger orchestration when a requirement status changes
   */
  static async onRequirementStatusChanged(params: {
    requirement_id: string;
    old_status: string;
    new_status: string;
    changed_by?: string;
  }): Promise<void> {
    try {
      console.log(`[ORCHESTRATION] Triggering on requirement status changed: ${params.requirement_id} from ${params.old_status} to ${params.new_status}`);

      const triggerData: TriggerOrchestrationRequest = {
        trigger_event: 'requirement_status_changed',
        requirement_id: params.requirement_id,
        trigger_data: {
          old_status: params.old_status,
          new_status: params.new_status,
          user_id: params.changed_by
        }
      };

      await PersonaOrchestrationService.triggerOrchestration(triggerData);
    } catch (error) {
      console.error('[ORCHESTRATION] Error triggering on requirement status changed:', error);
      // Don't throw - orchestration failures shouldn't break the main flow
    }
  }

  /**
   * Trigger orchestration when a refinement session status changes
   */
  static async onSessionStatusChanged(params: {
    session_id: string;
    requirement_id: string;
    old_status: string;
    new_status: string;
    changed_by?: string;
  }): Promise<void> {
    try {
      console.log(`[ORCHESTRATION] Triggering on session status changed: ${params.session_id} from ${params.old_status} to ${params.new_status}`);

      const triggerData: TriggerOrchestrationRequest = {
        trigger_event: 'session_status_changed',
        session_id: params.session_id,
        requirement_id: params.requirement_id,
        trigger_data: {
          old_status: params.old_status,
          new_status: params.new_status,
          user_id: params.changed_by
        }
      };

      await PersonaOrchestrationService.triggerOrchestration(triggerData);
    } catch (error) {
      console.error('[ORCHESTRATION] Error triggering on session status changed:', error);
      // Don't throw - orchestration failures shouldn't break the main flow
    }
  }

  /**
   * Trigger orchestration for user actions
   */
  static async onUserAction(params: {
    action_type: string;
    requirement_id?: string;
    session_id?: string;
    user_id: string;
    action_data?: any;
  }): Promise<void> {
    try {
      console.log(`[ORCHESTRATION] Triggering on user action: ${params.action_type}`);

      const triggerData: TriggerOrchestrationRequest = {
        trigger_event: params.action_type,
        requirement_id: params.requirement_id,
        session_id: params.session_id,
        trigger_data: {
          user_id: params.user_id,
          action_data: params.action_data
        }
      };

      await PersonaOrchestrationService.triggerOrchestration(triggerData);
    } catch (error) {
      console.error('[ORCHESTRATION] Error triggering on user action:', error);
      // Don't throw - orchestration failures shouldn't break the main flow
    }
  }

  /**
   * Generic orchestration trigger for custom events
   */
  static async triggerCustomEvent(triggerData: TriggerOrchestrationRequest): Promise<void> {
    try {
      console.log(`[ORCHESTRATION] Triggering custom event: ${triggerData.trigger_event}`);
      await PersonaOrchestrationService.triggerOrchestration(triggerData);
    } catch (error) {
      console.error('[ORCHESTRATION] Error triggering custom event:', error);
      // Don't throw - orchestration failures shouldn't break the main flow
    }
  }
}