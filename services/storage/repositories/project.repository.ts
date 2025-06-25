import {
  ProjectRepository,
  Project,
  CreateProjectRequest,
  UpdateProjectRequest,
  StorageService,
  ServiceError,
  ValidationError,
  NotFoundError
} from '../../../types/services';
import { generateId } from '../../../utils/common/generate-id';

export class LocalStorageProjectRepository implements ProjectRepository {
  private readonly storageKey = 'projects';
  
  constructor(private storageService: StorageService) {}

  async findAll(): Promise<Project[]> {
    try {
      const projects = await this.storageService.get<Project[]>(this.storageKey);
      return projects || [];
    } catch (error) {
      throw new ServiceError('ProjectRepository', 'Failed to load projects', error);
    }
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
      description: data.description || '',
      videoUrl: data.videoUrl,
      segments: [],
      queue: [],
      settings: {
        autoSave: true,
        autoSaveInterval: 30,
        defaultVolume: 100,
        playbackRate: 1.0,
        theme: 'light',
        visibility: 'private',
        ...data.settings
      },
      metadata: {
        createdAt: new Date(),
        updatedAt: new Date(),
        lastAccessedAt: new Date(),
        version: '1.0.0'
      }
    };

    projects.push(newProject);
    await this.storageService.set(this.storageKey, projects);
    
    return newProject;
  }

  async update(id: string, data: UpdateProjectRequest): Promise<Project> {
    const projects = await this.findAll();
    const index = projects.findIndex(p => p.id === id);
    
    if (index === -1) {
      throw new NotFoundError('ProjectRepository', 'Project', id);
    }

    const project = projects[index];
    
    // Update fields
    if (data.name !== undefined) project.name = data.name;
    if (data.description !== undefined) project.description = data.description;
    if (data.videoUrl !== undefined) project.videoUrl = data.videoUrl;
    if (data.settings) {
      project.settings = { ...project.settings, ...data.settings };
    }

    // Update metadata
    project.metadata.updatedAt = new Date();

    projects[index] = project;
    await this.storageService.set(this.storageKey, projects);
    
    return project;
  }

  async delete(id: string): Promise<void> {
    const projects = await this.findAll();
    const filteredProjects = projects.filter(p => p.id !== id);
    
    if (projects.length === filteredProjects.length) {
      throw new NotFoundError('ProjectRepository', 'Project', id);
    }

    await this.storageService.set(this.storageKey, filteredProjects);
  }

  async exists(id: string): Promise<boolean> {
    const project = await this.findById(id);
    return project !== null;
  }

  async findByName(name: string): Promise<Project[]> {
    const projects = await this.findAll();
    return projects.filter(p => p.name.toLowerCase().includes(name.toLowerCase()));
  }

  async search(query: string): Promise<Project[]> {
    const projects = await this.findAll();
    const lowerQuery = query.toLowerCase();
    
    return projects.filter(p => 
      p.name.toLowerCase().includes(lowerQuery) ||
      (p.description && p.description.toLowerCase().includes(lowerQuery))
    );
  }
} 