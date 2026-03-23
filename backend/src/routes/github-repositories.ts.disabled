import express, { Request, Response } from 'express';
import { GitHubRepositoryModel } from '../models/GitHubRepository';
import { ProjectModel } from '../models/Project';
import { CreateGitHubRepositoryRequest, UpdateGitHubRepositoryRequest } from '../models/types';
import { GitHubService } from '../services/github-service';

const router = express.Router();
const githubService = new GitHubService();

/**
 * POST /github-repositories/parse-url
 * Parse and validate a GitHub repository URL
 */
router.post('/parse-url', async (req: Request, res: Response) => {
  try {
    const { url, validate = false } = req.body;

    if (!url || typeof url !== 'string') {
      return res.status(400).json({
        error: 'Repository URL is required',
        format: 'Provide a "url" field with a GitHub repository URL'
      });
    }

    // Parse the URL
    const parsed = GitHubService.parseRepositoryUrl(url);
    if (!parsed) {
      return res.status(400).json({
        error: 'Invalid GitHub repository URL',
        message: 'URL must be in format: https://github.com/owner/repo or git@github.com:owner/repo.git'
      });
    }

    const result: any = {
      owner: parsed.owner,
      name: parsed.name,
      full_name: `${parsed.owner}/${parsed.name}`,
      valid: true
    };

    // Optionally validate access and fetch metadata
    if (validate) {
      try {
        const repoInfo = await githubService.getRepository(parsed.owner, parsed.name);
        if (repoInfo) {
          result.metadata = repoInfo;
          result.accessible = true;
        } else {
          result.accessible = false;
          result.error = 'Repository not found or not accessible';
        }
      } catch (error) {
        result.accessible = false;
        result.error = 'Failed to validate repository access';
      }
    }

    res.json(result);
  } catch (error) {
    console.error('[GITHUB_REPOS] Error parsing repository URL:', error);
    res.status(500).json({
      error: 'Failed to parse repository URL',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /github-repositories
 * Get all GitHub repositories for the current user
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id; // Assumes authentication middleware
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const repositories = await GitHubRepositoryModel.findByUserId(userId);

    res.json({
      repositories,
      count: repositories.length
    });
  } catch (error) {
    console.error('[GITHUB_REPOS] Error fetching repositories:', error);
    res.status(500).json({
      error: 'Failed to fetch GitHub repositories',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /github-repositories/:id
 * Get a specific GitHub repository by ID
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const repository = await GitHubRepositoryModel.findById(req.params.id);
    if (!repository) {
      return res.status(404).json({ error: 'GitHub repository not found' });
    }

    // Check if user has access
    const hasAccess = await GitHubRepositoryModel.canUserAccess(repository.id, userId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json(repository);
  } catch (error) {
    console.error('[GITHUB_REPOS] Error fetching repository:', error);
    res.status(500).json({
      error: 'Failed to fetch GitHub repository',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /github-repositories/project/:projectId
 * Get GitHub repository for a specific project
 */
router.get('/project/:projectId', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const projectId = req.params.projectId;

    // Check if user has access to the project
    const hasProjectAccess = await ProjectModel.canUserAccess(projectId, userId);
    if (!hasProjectAccess) {
      return res.status(403).json({ error: 'Project access denied' });
    }

    const repository = await GitHubRepositoryModel.findByProjectId(projectId);
    if (!repository) {
      return res.status(404).json({ error: 'No GitHub repository connected to this project' });
    }

    res.json(repository);
  } catch (error) {
    console.error('[GITHUB_REPOS] Error fetching project repository:', error);
    res.status(500).json({
      error: 'Failed to fetch project GitHub repository',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /github-repositories
 * Connect a GitHub repository to a project
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const data: CreateGitHubRepositoryRequest = req.body;

    // Validate required fields
    if (!data.project_id) {
      return res.status(400).json({
        error: 'Missing required field: project_id'
      });
    }

    // Support both explicit repo data and URL parsing
    let owner: string, name: string, github_repo_id: number;

    if (data.github_repo_id && data.owner && data.name) {
      // Explicit repository data provided
      owner = data.owner;
      name = data.name;
      github_repo_id = data.github_repo_id;
    } else if ((req.body as any).url) {
      // Parse from GitHub URL
      const parsed = GitHubService.parseRepositoryUrl((req.body as any).url);
      if (!parsed) {
        return res.status(400).json({
          error: 'Invalid GitHub repository URL',
          message: 'Provide either {github_repo_id, owner, name} or a valid GitHub URL'
        });
      }

      owner = parsed.owner;
      name = parsed.name;

      // Try to fetch repository info to get the GitHub ID
      const repoInfo = await githubService.getRepository(owner, name);
      if (!repoInfo) {
        return res.status(400).json({
          error: 'Repository not found or not accessible',
          message: 'Unable to fetch repository information from GitHub'
        });
      }

      github_repo_id = repoInfo.id;
    } else {
      return res.status(400).json({
        error: 'Missing repository information',
        message: 'Provide either {project_id, github_repo_id, owner, name} or {project_id, url}'
      });
    }

    // Update the data object with parsed values
    data.owner = owner;
    data.name = name;
    data.github_repo_id = github_repo_id;

    // Check if user has access to the project
    const hasProjectAccess = await ProjectModel.canUserAccess(data.project_id, userId);
    if (!hasProjectAccess) {
      return res.status(403).json({ error: 'Project access denied' });
    }

    // Check if project already has a repository connected
    const hasExistingRepo = await GitHubRepositoryModel.hasRepository(data.project_id);
    if (hasExistingRepo) {
      return res.status(409).json({
        error: 'Project already has a GitHub repository connected',
        message: 'Disconnect the existing repository before connecting a new one'
      });
    }

    // Check if this GitHub repository is already connected elsewhere
    const isRepoConnected = await GitHubRepositoryModel.isRepositoryConnected(data.github_repo_id);
    if (isRepoConnected) {
      return res.status(409).json({
        error: 'GitHub repository is already connected to another project'
      });
    }

    // Try to fetch additional metadata if possible
    let repositoryMetadata = undefined;
    try {
      const repoInfo = await githubService.getRepository(owner, name);
      if (repoInfo) {
        repositoryMetadata = {
          description: repoInfo.description,
          private: repoInfo.private,
          default_branch: repoInfo.default_branch,
          language: repoInfo.language,
          topics: repoInfo.topics,
          clone_url: repoInfo.clone_url,
          ssh_url: repoInfo.ssh_url,
          html_url: repoInfo.html_url,
        };
      }
    } catch (error) {
      console.warn('[GITHUB_REPOS] Could not fetch repository metadata:', error);
    }

    // Create the repository connection
    const repository = repositoryMetadata
      ? await GitHubRepositoryModel.createWithMetadata(data, repositoryMetadata)
      : await GitHubRepositoryModel.create(data);

    res.status(201).json({
      message: 'GitHub repository connected successfully',
      repository
    });
  } catch (error) {
    console.error('[GITHUB_REPOS] Error creating repository connection:', error);
    res.status(500).json({
      error: 'Failed to connect GitHub repository',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * PATCH /github-repositories/:id
 * Update GitHub repository connection settings
 */
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const repositoryId = req.params.id;
    const data: UpdateGitHubRepositoryRequest = req.body;

    // Check if repository exists
    const existing = await GitHubRepositoryModel.findById(repositoryId);
    if (!existing) {
      return res.status(404).json({ error: 'GitHub repository not found' });
    }

    // Check if user has access
    const hasAccess = await GitHubRepositoryModel.canUserAccess(repositoryId, userId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Update the repository
    const updated = await GitHubRepositoryModel.update(repositoryId, data);
    if (!updated) {
      return res.status(500).json({ error: 'Failed to update repository' });
    }

    res.json({
      message: 'GitHub repository updated successfully',
      repository: updated
    });
  } catch (error) {
    console.error('[GITHUB_REPOS] Error updating repository:', error);
    res.status(500).json({
      error: 'Failed to update GitHub repository',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * DELETE /github-repositories/:id
 * Disconnect a GitHub repository from its project
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const repositoryId = req.params.id;

    // Check if repository exists
    const existing = await GitHubRepositoryModel.findById(repositoryId);
    if (!existing) {
      return res.status(404).json({ error: 'GitHub repository not found' });
    }

    // Check if user has access (must be project owner for deletion)
    const isProjectOwner = await ProjectModel.isUserOwner(existing.project_id, userId);
    if (!isProjectOwner) {
      return res.status(403).json({
        error: 'Only project owners can disconnect GitHub repositories'
      });
    }

    // Delete the repository connection
    const deleted = await GitHubRepositoryModel.delete(repositoryId);
    if (!deleted) {
      return res.status(500).json({ error: 'Failed to disconnect repository' });
    }

    res.json({
      message: 'GitHub repository disconnected successfully'
    });
  } catch (error) {
    console.error('[GITHUB_REPOS] Error deleting repository:', error);
    res.status(500).json({
      error: 'Failed to disconnect GitHub repository',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;