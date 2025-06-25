import { ProjectService } from '../project.service';
import { createProjectService, getProjectService } from '../project.service';
import { 
  Project, 
  CreateProjectRequest, 
  UpdateProjectRequest, 
  ExportFormat, 
  ValidationError, 
  NotFoundError, 
  ServiceError 
} from '../../../types/services';

// Mock localStorage
const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
  key: jest.fn(),
  length: 0
};

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage
});

describe('ProjectService', () => {
  let projectService: ProjectService;
  
  const mockProject: Project = {
    id: 'test-project-1',
    name: 'Test Project',
    description: 'A test project',
    videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    segments: [],
    queue: [],
    settings: {
      autoSave: true,
      autoSaveInterval: 30,
      defaultVolume: 100,
      playbackRate: 1.0,
      theme: 'light',
      visibility: 'private'
    },
    metadata: {
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-02'),
      lastAccessedAt: new Date('2024-01-02'),
      version: '1.0.0'
    }
  };

  beforeEach(() => {
    projectService = new ProjectService();
    jest.clearAllMocks();
    mockLocalStorage.length = 0;
  });

  describe('Constructor and Factory', () => {
    it('should create instance with default options', () => {
      expect(projectService).toBeInstanceOf(ProjectService);
      expect(projectService.isHealthy()).resolves.toBe(true);
    });

    it('should create instance via factory function', () => {
      const service = createProjectService();
      expect(service).toBeInstanceOf(ProjectService);
    });

    it('should return singleton instance', () => {
      const service1 = getProjectService();
      const service2 = getProjectService();
      expect(service1).toBe(service2);
    });
  });

  describe('createProject', () => {
    it('should create a new project successfully', async () => {
      const projectData: CreateProjectRequest = {
        name: 'New Project',
        description: 'A new project',
        videoUrl: 'https://www.youtube.com/watch?v=test123',
        settings: { 
          autoSave: true, 
          autoSaveInterval: 30, 
          defaultVolume: 100,
          playbackRate: 1.0,
          theme: 'light',
          visibility: 'private'
        }
      };

      mockLocalStorage.getItem.mockReturnValue(JSON.stringify([]));

      const result = await projectService.createProject(projectData);

      expect(result).toMatchObject({
        name: projectData.name,
        description: projectData.description,
        videoUrl: projectData.videoUrl
      });
      expect(result.id).toBeDefined();
      expect(result.metadata.createdAt).toBeInstanceOf(Date);
      expect(mockLocalStorage.setItem).toHaveBeenCalled();
    });

    it('should throw ValidationError for invalid project data', async () => {
      const invalidData: CreateProjectRequest = {
        name: '', // Empty name should be invalid
        description: 'Test',
        videoUrl: 'https://www.youtube.com/watch?v=test123'
      };

      await expect(projectService.createProject(invalidData))
        .rejects.toThrow(ValidationError);
    });

    it('should handle localStorage errors', async () => {
      mockLocalStorage.getItem.mockImplementation(() => {
        throw new Error('Storage error');
      });

      const projectData: CreateProjectRequest = {
        name: 'Test Project',
        description: 'Test',
        videoUrl: 'https://www.youtube.com/watch?v=test123'
      };

      await expect(projectService.createProject(projectData))
        .rejects.toThrow(ServiceError);
    });
  });

  describe('getProject', () => {
    it('should retrieve existing project', async () => {
      const projects = [mockProject];
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(projects));

      const result = await projectService.getProject('test-project-1');

      expect(result.id).toBe(mockProject.id);
      expect(result.name).toBe(mockProject.name);
    });

    it('should throw NotFoundError for non-existent project', async () => {
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify([]));

      await expect(projectService.getProject('non-existent'))
        .rejects.toThrow(NotFoundError);
    });

    it('should handle corrupted localStorage data', async () => {
      mockLocalStorage.getItem.mockReturnValue('invalid json');

      await expect(projectService.getProject('test-id'))
        .rejects.toThrow(ServiceError);
    });
  });

  describe('updateProject', () => {
    beforeEach(() => {
      const projects = [mockProject];
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(projects));
    });

    it('should update existing project', async () => {
      const updates: UpdateProjectRequest = {
        name: 'Updated Project Name',
        description: 'Updated description'
      };

      const result = await projectService.updateProject('test-project-1', updates);

      expect(result.name).toBe(updates.name);
      expect(result.description).toBe(updates.description);
      expect(result.metadata.updatedAt).toBeInstanceOf(Date);
      expect(mockLocalStorage.setItem).toHaveBeenCalled();
    });

    it('should throw NotFoundError for non-existent project', async () => {
      const updates: UpdateProjectRequest = { name: 'Updated Name' };

      await expect(projectService.updateProject('non-existent', updates))
        .rejects.toThrow(NotFoundError);
    });

    it('should validate update data', async () => {
      const invalidUpdates: UpdateProjectRequest = { name: '' }; // Empty name

      await expect(projectService.updateProject('test-project-1', invalidUpdates))
        .rejects.toThrow(ValidationError);
    });
  });

  describe('deleteProject', () => {
    beforeEach(() => {
      const projects = [mockProject];
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(projects));
    });

    it('should delete existing project', async () => {
      await projectService.deleteProject('test-project-1');

      expect(mockLocalStorage.setItem).toHaveBeenCalled();
    });

    it('should throw NotFoundError for non-existent project', async () => {
      await expect(projectService.deleteProject('non-existent'))
        .rejects.toThrow(NotFoundError);
    });
  });

  describe('getAllProjects', () => {
    it('should return all projects with pagination', async () => {
      const projects = [mockProject];
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(projects));

      const result = await projectService.getAllProjects();

      expect(result.items).toEqual(projects);
      expect(result.pagination).toBeDefined();
      expect(result.pagination.totalItems).toBe(1);
    });

    it('should return empty array when no projects exist', async () => {
      mockLocalStorage.getItem.mockReturnValue(null);

      const result = await projectService.getAllProjects();

      expect(result.items).toEqual([]);
      expect(result.pagination.totalItems).toBe(0);
    });

    it('should handle search and pagination', async () => {
      const projects = [mockProject];
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(projects));

      const result = await projectService.getAllProjects({
        filters: { query: 'Test' },
        page: 1,
        pageSize: 10
      });

      expect(result.items).toHaveLength(1);
      expect(result.pagination.page).toBe(1);
    });

    it('should handle sorting', async () => {
      const projects = [mockProject];
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(projects));

      const result = await projectService.getAllProjects({
        sortBy: 'name',
        sortOrder: 'desc'
      });

      expect(result.items).toHaveLength(1);
    });
  });

  describe('duplicateProject', () => {
    beforeEach(() => {
      const projects = [mockProject];
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(projects));
    });

    it('should duplicate existing project', async () => {
      const result = await projectService.duplicateProject('test-project-1', 'Duplicated Project');

      expect(result.name).toBe('Duplicated Project');
      expect(result.id).not.toBe(mockProject.id);
      expect(result.description).toBe(mockProject.description);
      expect(result.videoUrl).toBe(mockProject.videoUrl);
    });

    it('should throw NotFoundError for non-existent project', async () => {
      await expect(projectService.duplicateProject('non-existent', 'Clone'))
        .rejects.toThrow(NotFoundError);
    });
  });

  describe('exportProject', () => {
    beforeEach(() => {
      const projects = [mockProject];
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(projects));
    });

    it('should export project as JSON', async () => {
      const result = await projectService.exportProject('test-project-1', 'json');

      expect(result.format).toBe('json');
      expect(result.filename).toContain('.json');
      expect(typeof result.data).toBe('string');
    });

    it('should export project as CSV', async () => {
      const result = await projectService.exportProject('test-project-1', 'csv');

      expect(result.format).toBe('csv');
      expect(result.filename).toContain('.csv');
      expect(typeof result.data).toBe('string');
    });

    it('should throw NotFoundError for non-existent project', async () => {
      await expect(projectService.exportProject('non-existent', 'json'))
        .rejects.toThrow(NotFoundError);
    });
  });

  describe('importProject', () => {
    it('should import valid JSON project', async () => {
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify([]));
      const projectJson = JSON.stringify(mockProject);

      const result = await projectService.importProject({
        format: 'json',
        data: projectJson
      });

      expect(result.name).toBe(mockProject.name);
      expect(mockLocalStorage.setItem).toHaveBeenCalled();
    });

    it('should throw ValidationError for invalid JSON', async () => {
      await expect(projectService.importProject({
        format: 'json',
        data: 'invalid json'
      })).rejects.toThrow(ValidationError);
    });
  });

  describe('shareProject', () => {
    beforeEach(() => {
      const projects = [mockProject];
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(projects));
    });

    it('should share project successfully', async () => {
      const shareOptions = {
        visibility: 'public' as const,
        allowComments: true,
        allowDownload: true
      };

      const result = await projectService.shareProject('test-project-1', shareOptions);

      expect(result.shareId).toBeDefined();
      expect(result.shareUrl).toBeDefined();
    });

    it('should throw NotFoundError for non-existent project', async () => {
      const shareOptions = {
        visibility: 'public' as const
      };

      await expect(projectService.shareProject('non-existent', shareOptions))
        .rejects.toThrow(NotFoundError);
    });
  });

  describe('Health Check', () => {
    it('should return healthy status', async () => {
      const isHealthy = await projectService.isHealthy();
      expect(isHealthy).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle localStorage quota exceeded', async () => {
      mockLocalStorage.setItem.mockImplementation(() => {
        const error = new Error('QuotaExceededError');
        error.name = 'QuotaExceededError';
        throw error;
      });

      const projectData: CreateProjectRequest = {
        name: 'Test Project',
        description: 'Test',
        videoUrl: 'https://www.youtube.com/watch?v=test123'
      };

      await expect(projectService.createProject(projectData))
        .rejects.toThrow(ServiceError);
    });

    it('should handle localStorage access denied', async () => {
      mockLocalStorage.getItem.mockImplementation(() => {
        throw new Error('Access denied');
      });

      await expect(projectService.getAllProjects())
        .rejects.toThrow(ServiceError);
    });
  });

  describe('Validation', () => {
    it('should validate project name length', async () => {
      const longName = 'a'.repeat(256); // Assuming max length is 255
      const projectData: CreateProjectRequest = {
        name: longName,
        description: 'Test',
        videoUrl: 'https://www.youtube.com/watch?v=test123'
      };

      await expect(projectService.createProject(projectData))
        .rejects.toThrow(ValidationError);
    });

    it('should validate video URL format', async () => {
      const projectData: CreateProjectRequest = {
        name: 'Test Project',
        description: 'Test',
        videoUrl: 'invalid-url'
      };

      await expect(projectService.createProject(projectData))
        .rejects.toThrow(ValidationError);
    });
  });
}); 