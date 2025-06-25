import {
  ProjectService as IProjectService,
  Project,
  CreateProjectRequest,
  UpdateProjectRequest,
  ExportFormat,
  ExportResult,
  ImportData,
  ShareOptions,
  ShareResult,
  PaginatedResponse,
  SearchOptions,
  ServiceError,
  ValidationError,
  NotFoundError,
  ProjectRepository
} from '../../types/services';
import { ProjectExportService, getProjectExportService } from './project-export.service';

export class ProjectService implements IProjectService {
  readonly serviceName = 'ProjectService';
  readonly version = '1.0.0';
  
  constructor(
    private readonly projectRepository: ProjectRepository,
    private readonly exportService: ProjectExportService = getProjectExportService()
  ) {}

  async isHealthy(): Promise<boolean> {
    try {
      // Check if repository is accessible
      await this.projectRepository.findAll();
      return true;
    } catch {
      return false;
    }
  }

  async createProject(project: CreateProjectRequest): Promise<Project> {
    this.validateCreateRequest(project);
    return await this.projectRepository.create(project);
  }

  async getProject(id: string): Promise<Project> {
    if (!id) {
      throw new ValidationError(this.serviceName, 'id', id, 'string');
    }

    const project = await this.projectRepository.findById(id);
    if (!project) {
      throw new NotFoundError(this.serviceName, 'Project', id);
    }

    // Update last accessed time
    project.metadata.lastAccessedAt = new Date();
    // Note: metadata update should be handled by repository implementation

    return project;
  }

  async getAllProjects(options?: SearchOptions): Promise<PaginatedResponse<Project>> {
    let projects = await this.projectRepository.findAll();

    // Apply search if provided
    if (options?.filters?.query) {
      const query = options.filters.query.toLowerCase();
      projects = projects.filter((p: Project) => 
        p.name.toLowerCase().includes(query) ||
        (p.description && p.description.toLowerCase().includes(query))
      );
    }

    // Apply sorting
    if (options?.sortBy) {
      projects.sort((a: Project, b: Project) => {
        let aValue: any, bValue: any;
        
        switch (options.sortBy) {
          case 'name':
            aValue = a.name;
            bValue = b.name;
            break;
          case 'createdAt':
            aValue = a.metadata.createdAt;
            bValue = b.metadata.createdAt;
            break;
          case 'updatedAt':
          default:
            aValue = a.metadata.updatedAt;
            bValue = b.metadata.updatedAt;
        }

        if (aValue < bValue) return options.sortOrder === 'asc' ? -1 : 1;
        if (aValue > bValue) return options.sortOrder === 'asc' ? 1 : -1;
        return 0;
      });
    } else {
      // Default sort by updatedAt desc
      projects.sort((a: Project, b: Project) => b.metadata.updatedAt.getTime() - a.metadata.updatedAt.getTime());
    }

    // Apply pagination
    const page = options?.page || 1;
    const pageSize = options?.pageSize || 10;
    const totalItems = projects.length;
    const totalPages = Math.ceil(totalItems / pageSize);
    const offset = (page - 1) * pageSize;
    const items = projects.slice(offset, offset + pageSize);

    return {
      items,
      pagination: {
        page,
        pageSize,
        totalItems,
        totalPages,
        hasNext: page < totalPages,
        hasPrevious: page > 1
      }
    };
  }

  async updateProject(id: string, updates: UpdateProjectRequest): Promise<Project> {
    this.validateUpdateRequest(updates);
    
    return await this.projectRepository.update(id, updates);
  }

  async deleteProject(id: string): Promise<void> {
    if (!await this.projectRepository.exists(id)) {
      throw new NotFoundError(this.serviceName, 'Project', id);
    }
    
    await this.projectRepository.delete(id);
  }

  async duplicateProject(id: string, newName: string): Promise<Project> {
    const original = await this.getProject(id);
    
    const createRequest: CreateProjectRequest = {
      name: newName,
      description: original.description,
      videoUrl: original.videoUrl,
      settings: original.settings
    };

    return await this.projectRepository.create(createRequest);
  }

  async exportProject(id: string, format: ExportFormat): Promise<ExportResult> {
    const project = await this.getProject(id);
    return await this.exportService.exportProject(project, format);
  }

  async importProject(data: ImportData): Promise<Project> {
    const project = await this.exportService.importProject(data);
    return await this.projectRepository.create({
      name: project.name,
      description: project.description,
      videoUrl: project.videoUrl,
      settings: project.settings
    });
  }

  async shareProject(id: string, shareOptions: ShareOptions): Promise<ShareResult> {
    const project = await this.getProject(id);
    
    // Generate share ID and URL
    const shareId = `${project.id}-${Date.now()}`;
    const shareUrl = `https://pi-que.app/shared/${shareId}`;

    return {
      shareId,
      shareUrl,
      expiresAt: shareOptions.expiresAt
    };
  }

  async getSharedProject(shareId: string): Promise<Project> {
    // In a real implementation, this would fetch from a shared projects store
    // For now, we'll extract the original project ID from the share ID
    const projectId = shareId.split('-')[0];
    return this.getProject(projectId);
  }

  // Private helper methods
  private validateCreateRequest(request: CreateProjectRequest): void {
    if (!request.name || request.name.trim().length === 0) {
      throw new ValidationError('ProjectService', 'name', request.name, 'non-empty string');
    }
    
    if (request.name.length > 100) {
      throw new ValidationError('ProjectService', 'name', request.name, 'string (max 100 chars)');
    }

    if (!request.videoUrl || request.videoUrl.trim().length === 0) {
      throw new ValidationError('ProjectService', 'videoUrl', request.videoUrl, 'non-empty string');
    }
  }

  private validateUpdateRequest(request: UpdateProjectRequest): void {
    if (request.name !== undefined) {
      if (!request.name || request.name.trim().length === 0) {
        throw new ValidationError('ProjectService', 'name', request.name, 'non-empty string');
      }
      if (request.name.length > 100) {
        throw new ValidationError('ProjectService', 'name', request.name, 'string (max 100 chars)');
      }
    }

    if (request.videoUrl !== undefined && (!request.videoUrl || request.videoUrl.trim().length === 0)) {
      throw new ValidationError('ProjectService', 'videoUrl', request.videoUrl, 'non-empty string');
    }
  }


}

// Factory function
export const createProjectService = (projectRepository: ProjectRepository): ProjectService => {
  return new ProjectService(projectRepository);
};

// Singleton instance
let projectServiceInstance: ProjectService | null = null;

export const getProjectService = (projectRepository?: ProjectRepository): ProjectService => {
  if (!projectServiceInstance && projectRepository) {
    projectServiceInstance = createProjectService(projectRepository);
  }
  if (!projectServiceInstance) {
    throw new ServiceError('ProjectService not initialized. Please provide a ProjectRepository', 'ProjectService', 'NOT_INITIALIZED');
  }
  return projectServiceInstance;
}; 