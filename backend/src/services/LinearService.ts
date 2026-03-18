import { LinearConnectionValidationResult } from '../models/types';

interface LinearApiResponse<T = any> {
  data?: T;
  errors?: Array<{
    message: string;
    extensions?: any;
  }>;
}

interface LinearWorkspace {
  id: string;
  name: string;
  teams: {
    nodes: LinearTeam[];
  };
}

interface LinearTeam {
  id: string;
  name: string;
  key: string;
  organization: {
    id: string;
    name: string;
  };
}

interface LinearProject {
  id: string;
  name: string;
  description?: string;
}

interface LinearViewer {
  id: string;
  name: string;
  email: string;
  organization: {
    id: string;
    name: string;
  };
}

export class LinearService {
  private static readonly LINEAR_API_URL = 'https://api.linear.app/graphql';

  // Make GraphQL request to Linear API
  private static async makeRequest<T>(
    query: string,
    variables: any = {},
    apiToken: string
  ): Promise<LinearApiResponse<T>> {
    try {
      const response = await fetch(this.LINEAR_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': apiToken,
        },
        body: JSON.stringify({
          query,
          variables,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      return {
        errors: [
          {
            message: error instanceof Error ? error.message : 'Unknown API error',
          },
        ],
      };
    }
  }

  // Validate Linear API token and get viewer info
  static async validateApiToken(apiToken: string): Promise<{
    valid: boolean;
    viewer?: LinearViewer;
    error?: string;
  }> {
    const query = `
      query GetViewer {
        viewer {
          id
          name
          email
          organization {
            id
            name
          }
        }
      }
    `;

    const response = await this.makeRequest<{ viewer: LinearViewer }>(
      query,
      {},
      apiToken
    );

    if (response.errors?.length) {
      return {
        valid: false,
        error: response.errors[0].message,
      };
    }

    if (!response.data?.viewer) {
      return {
        valid: false,
        error: 'Unable to fetch viewer information',
      };
    }

    return {
      valid: true,
      viewer: response.data.viewer,
    };
  }

  // Get workspace information
  static async getWorkspace(
    workspaceId: string,
    apiToken: string
  ): Promise<{ workspace?: LinearWorkspace; error?: string }> {
    const query = `
      query GetWorkspace($id: String!) {
        workspace(id: $id) {
          id
          name
          teams {
            nodes {
              id
              name
              key
              organization {
                id
                name
              }
            }
          }
        }
      }
    `;

    const response = await this.makeRequest<{ workspace: LinearWorkspace }>(
      query,
      { id: workspaceId },
      apiToken
    );

    if (response.errors?.length) {
      return {
        error: response.errors[0].message,
      };
    }

    if (!response.data?.workspace) {
      return {
        error: 'Workspace not found',
      };
    }

    return {
      workspace: response.data.workspace,
    };
  }

  // Get team information
  static async getTeam(
    teamId: string,
    apiToken: string
  ): Promise<{ team?: LinearTeam; error?: string }> {
    const query = `
      query GetTeam($id: String!) {
        team(id: $id) {
          id
          name
          key
          organization {
            id
            name
          }
        }
      }
    `;

    const response = await this.makeRequest<{ team: LinearTeam }>(
      query,
      { id: teamId },
      apiToken
    );

    if (response.errors?.length) {
      return {
        error: response.errors[0].message,
      };
    }

    if (!response.data?.team) {
      return {
        error: 'Team not found',
      };
    }

    return {
      team: response.data.team,
    };
  }

  // Get project information (if project ID is provided)
  static async getProject(
    projectId: string,
    apiToken: string
  ): Promise<{ project?: LinearProject; error?: string }> {
    const query = `
      query GetProject($id: String!) {
        project(id: $id) {
          id
          name
          description
        }
      }
    `;

    const response = await this.makeRequest<{ project: LinearProject }>(
      query,
      { id: projectId },
      apiToken
    );

    if (response.errors?.length) {
      return {
        error: response.errors[0].message,
      };
    }

    if (!response.data?.project) {
      return {
        error: 'Project not found',
      };
    }

    return {
      project: response.data.project,
    };
  }

  // Comprehensive validation of Linear connection
  static async validateConnection(
    apiToken: string,
    workspaceId: string,
    teamId: string,
    boardId?: string,
    projectId?: string
  ): Promise<LinearConnectionValidationResult> {
    // Step 1: Validate API token
    const tokenValidation = await this.validateApiToken(apiToken);
    if (!tokenValidation.valid) {
      return {
        is_valid: false,
        error: `Invalid API token: ${tokenValidation.error}`,
      };
    }

    const viewer = tokenValidation.viewer!;
    const result: LinearConnectionValidationResult = {
      is_valid: true,
      organization: {
        id: viewer.organization.id,
        name: viewer.organization.name,
      },
      permissions: [], // TODO: Extract permissions from API
    };

    // Step 2: Validate workspace
    const workspaceResult = await this.getWorkspace(workspaceId, apiToken);
    if (workspaceResult.error) {
      return {
        is_valid: false,
        error: `Invalid workspace: ${workspaceResult.error}`,
      };
    }

    result.workspace = {
      id: workspaceResult.workspace!.id,
      name: workspaceResult.workspace!.name,
    };

    // Step 3: Validate team
    const teamResult = await this.getTeam(teamId, apiToken);
    if (teamResult.error) {
      return {
        is_valid: false,
        error: `Invalid team: ${teamResult.error}`,
      };
    }

    result.team = {
      id: teamResult.team!.id,
      name: teamResult.team!.name,
    };

    // Step 4: Validate project if provided
    if (projectId) {
      const projectResult = await this.getProject(projectId, apiToken);
      if (projectResult.error) {
        return {
          is_valid: false,
          error: `Invalid project: ${projectResult.error}`,
        };
      }

      result.project = {
        id: projectResult.project!.id,
        name: projectResult.project!.name,
      };
    }

    // TODO: Validate board if boardId is provided
    // Linear might not have a direct "board" concept, might need to use Projects instead

    return result;
  }

  // Create Linear issue (B-504)
  static async createIssue(
    apiToken: string,
    data: {
      title: string;
      description?: string;
      teamId: string;
      projectId?: string;
      priority?: number;
      labelIds?: string[];
      assigneeId?: string;
      stateId?: string;
    }
  ): Promise<{
    success: boolean;
    issue?: {
      id: string;
      identifier: string;
      title: string;
      url: string;
    };
    error?: string;
  }> {
    const mutation = `
      mutation CreateIssue($input: IssueCreateInput!) {
        issueCreate(input: $input) {
          success
          issue {
            id
            identifier
            title
            url
          }
        }
      }
    `;

    const input: any = {
      title: data.title,
      teamId: data.teamId,
    };

    if (data.description) {
      input.description = data.description;
    }

    if (data.projectId) {
      input.projectId = data.projectId;
    }

    if (data.priority) {
      input.priority = data.priority;
    }

    if (data.labelIds && data.labelIds.length > 0) {
      input.labelIds = data.labelIds;
    }

    if (data.assigneeId) {
      input.assigneeId = data.assigneeId;
    }

    if (data.stateId) {
      input.stateId = data.stateId;
    }

    const response = await this.makeRequest<{
      issueCreate: {
        success: boolean;
        issue?: {
          id: string;
          identifier: string;
          title: string;
          url: string;
        };
      };
    }>(mutation, { input }, apiToken);

    if (response.errors?.length) {
      return {
        success: false,
        error: response.errors[0].message,
      };
    }

    if (!response.data?.issueCreate) {
      return {
        success: false,
        error: 'No response from Linear API',
      };
    }

    const { success, issue } = response.data.issueCreate;

    return {
      success,
      issue,
      error: success ? undefined : 'Issue creation failed',
    };
  }

  // Get team states for issue creation
  static async getTeamStates(
    teamId: string,
    apiToken: string
  ): Promise<{ states?: Array<{ id: string; name: string; type: string }>; error?: string }> {
    const query = `
      query GetTeamStates($teamId: String!) {
        team(id: $teamId) {
          states {
            nodes {
              id
              name
              type
            }
          }
        }
      }
    `;

    const response = await this.makeRequest<{
      team: {
        states: {
          nodes: Array<{ id: string; name: string; type: string }>;
        };
      };
    }>(query, { teamId }, apiToken);

    if (response.errors?.length) {
      return {
        error: response.errors[0].message,
      };
    }

    if (!response.data?.team) {
      return {
        error: 'Team not found',
      };
    }

    return {
      states: response.data.team.states.nodes,
    };
  }

  // Get team labels for issue creation
  static async getTeamLabels(
    teamId: string,
    apiToken: string
  ): Promise<{ labels?: Array<{ id: string; name: string; color: string }>; error?: string }> {
    const query = `
      query GetTeamLabels($teamId: String!) {
        team(id: $teamId) {
          labels {
            nodes {
              id
              name
              color
            }
          }
        }
      }
    `;

    const response = await this.makeRequest<{
      team: {
        labels: {
          nodes: Array<{ id: string; name: string; color: string }>;
        };
      };
    }>(query, { teamId }, apiToken);

    if (response.errors?.length) {
      return {
        error: response.errors[0].message,
      };
    }

    if (!response.data?.team) {
      return {
        error: 'Team not found',
      };
    }

    return {
      labels: response.data.team.labels.nodes,
    };
  }
}