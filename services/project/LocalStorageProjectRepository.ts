import { 
  ProjectRepository, 
  Project, 
  CreateProjectRequest, 
  UpdateProjectRequest,
  StorageService 
} from '../../types/services';
import { generateId } from '../../utils/common/id';

/**
 * LocalStorage를 사용한 Project Repository 구현체
 * DIP(Dependency Inversion Principle)를 준수하여 StorageService에 의존
 */
export class LocalStorageProjectRepository implements ProjectRepository {
  private readonly STORAGE_KEY = 'projects';
  
  constructor(private readonly storageService: StorageService) {}

  async findAll(): Promise<Project[]> {
    const projects = await this.storageService.get<Project[]>(this.STORAGE_KEY);
    return projects || [];
  }

  async findById(id: string): Promise<Project | null> {
    const projects = await this.findAll();
    return projects.find(p => p.id === id) || null;
  }

  async create(data: CreateProjectRequest): Promise<Project> {
    const projects = await this.findAll();
    
    const newProject: Project = {
      id: generateId(),
      name: data.name,
      description: data.description,
      videoUrl: data.videoUrl,
      segments: [],
      queue: [],
      settings: {
        autoSave: true,
        autoSaveInterval: 30,
        defaultVolume: 100,
        playbackRate: 1.0,
        theme: 'auto',
        visibility: 'private',
        ...data.settings
      },
      metadata: {
        createdAt: new Date(),
        updatedAt: new Date(),
        lastAccessedAt: new Date(),
        version: '1.0.0',
        tags: []
      }
    };

    projects.push(newProject);
    await this.storageService.set(this.STORAGE_KEY, projects);
    
    return newProject;
  }

  async update(id: string, data: UpdateProjectRequest): Promise<Project> {
    const projects = await this.findAll();
    const projectIndex = projects.findIndex(p => p.id === id);
    
    if (projectIndex === -1) {
      throw new Error(`Project with id ${id} not found`);
    }

    const existingProject = projects[projectIndex];
    const updatedProject: Project = {
      ...existingProject,
      ...data,
      settings: {
        ...existingProject.settings,
        ...data.settings
      },
      metadata: {
        ...existingProject.metadata,
        updatedAt: new Date()
      }
    };

    projects[projectIndex] = updatedProject;
    await this.storageService.set(this.STORAGE_KEY, projects);
    
    return updatedProject;
  }

  async delete(id: string): Promise<void> {
    const projects = await this.findAll();
    const filteredProjects = projects.filter(p => p.id !== id);
    
    if (filteredProjects.length === projects.length) {
      throw new Error(`Project with id ${id} not found`);
    }

    await this.storageService.set(this.STORAGE_KEY, filteredProjects);
  }

  async exists(id: string): Promise<boolean> {
    const project = await this.findById(id);
    return project !== null;
  }

  async findByName(name: string): Promise<Project[]> {
    const projects = await this.findAll();
    return projects.filter(p => 
      p.name.toLowerCase().includes(name.toLowerCase())
    );
  }

  async search(query: string): Promise<Project[]> {
    const projects = await this.findAll();
    const searchTerm = query.toLowerCase();
    
    return projects.filter(p => 
      p.name.toLowerCase().includes(searchTerm) ||
      p.description?.toLowerCase().includes(searchTerm) ||
      p.metadata.tags?.some(tag => tag.toLowerCase().includes(searchTerm))
    );
  }
} 