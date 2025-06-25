import {
  Project,
  ExportFormat,
  ExportResult,
  ImportData,
  BaseService,
  ServiceError,
  ValidationError
} from '../../types/services';

/**
 * 프로젝트 파일 export/import를 담당하는 서비스
 * Single Responsibility Principle: 파일 변환과 I/O만 담당
 */
export interface ProjectExportService extends BaseService {
  exportProject(project: Project, format: ExportFormat): Promise<ExportResult>;
  importProject(data: ImportData): Promise<Project>;
  validateImportData(data: ImportData): Promise<boolean>;
  getSupportedFormats(): ExportFormat[];
}

export class ProjectExportServiceImpl implements ProjectExportService {
  readonly serviceName = 'ProjectExportService';
  readonly version = '1.0.0';

  async isHealthy(): Promise<boolean> {
    try {
      // Test basic functionality
      const testProject = this.createTestProject();
      const result = await this.exportProject(testProject, 'json');
      return typeof result.data === 'string' ? result.data.length > 0 : result.data.size > 0;
    } catch {
      return false;
    }
  }

  async exportProject(project: Project, format: ExportFormat): Promise<ExportResult> {
    this.validateProject(project);
    this.validateFormat(format);

    let data: string;
    let filename: string;

    switch (format) {
      case 'json':
        data = JSON.stringify(project, null, 2);
        filename = `${this.sanitizeFilename(project.name)}.json`;
        break;
      
      case 'csv':
        data = this.exportToCSV(project);
        filename = `${this.sanitizeFilename(project.name)}.csv`;
        break;
      
      case 'srt':
        data = this.exportToSRT(project);
        filename = `${this.sanitizeFilename(project.name)}.srt`;
        break;
      
      case 'vtt':
        data = this.exportToVTT(project);
        filename = `${this.sanitizeFilename(project.name)}.vtt`;
        break;
      
      default:
        throw new ValidationError(this.serviceName, 'format', format, 'supported export format');
    }

    return { format, data, filename };
  }

  async importProject(data: ImportData): Promise<Project> {
    await this.validateImportData(data);

    let content: string;
    
    if (typeof data.data === 'string') {
      content = data.data;
    } else {
      content = await this.readFile(data.data);
    }

    switch (data.format) {
      case 'json':
        return this.importFromJSON(content);
      
      case 'csv':
        throw new ServiceError('CSV import not yet implemented', this.serviceName, 'NOT_IMPLEMENTED');
      
      case 'srt':
        throw new ServiceError('SRT import not yet implemented', this.serviceName, 'NOT_IMPLEMENTED');
      
      case 'vtt':
        throw new ServiceError('VTT import not yet implemented', this.serviceName, 'NOT_IMPLEMENTED');
      
      default:
        throw new ValidationError(this.serviceName, 'format', data.format, 'supported import format');
    }
  }

  async validateImportData(data: ImportData): Promise<boolean> {
    if (!data || !data.format || !data.data) {
      throw new ValidationError(this.serviceName, 'data', data, 'ImportData object');
    }

    if (!this.getSupportedFormats().includes(data.format)) {
      throw new ValidationError(this.serviceName, 'format', data.format, 'supported format');
    }

    return true;
  }

  getSupportedFormats(): ExportFormat[] {
    return ['json', 'csv', 'srt', 'vtt'];
  }

  private validateProject(project: Project): void {
    if (!project) {
      throw new ValidationError(this.serviceName, 'project', project, 'Project object');
    }
    if (!project.name) {
      throw new ValidationError(this.serviceName, 'project.name', project.name, 'non-empty string');
    }
  }

  private validateFormat(format: ExportFormat): void {
    if (!this.getSupportedFormats().includes(format)) {
      throw new ValidationError(this.serviceName, 'format', format, 'supported export format');
    }
  }

  private exportToCSV(project: Project): string {
    const headers = ['ID', 'Title', 'Description', 'Start Time', 'End Time', 'Duration', 'Tags'];
    const rows = [headers.join(',')];

    project.segments.forEach(segment => {
      const row = [
        segment.id,
        `"${segment.title.replace(/"/g, '""')}"`,
        `"${(segment.description || '').replace(/"/g, '""')}"`,
        this.formatTime(segment.startTime),
        this.formatTime(segment.endTime),
        this.formatTime(segment.endTime - segment.startTime),
        `"${segment.tags.join(', ')}"`
      ];
      rows.push(row.join(','));
    });

    return rows.join('\n');
  }

  private exportToSRT(project: Project): string {
    return project.segments
      .sort((a, b) => a.startTime - b.startTime)
      .map((segment, index) => {
        const startTime = this.formatSRTTime(segment.startTime);
        const endTime = this.formatSRTTime(segment.endTime);
        return `${index + 1}\n${startTime} --> ${endTime}\n${segment.title}\n`;
      })
      .join('\n');
  }

  private exportToVTT(project: Project): string {
    const header = 'WEBVTT\n\n';
    const cues = project.segments
      .sort((a, b) => a.startTime - b.startTime)
      .map(segment => {
        const startTime = this.formatVTTTime(segment.startTime);
        const endTime = this.formatVTTTime(segment.endTime);
        return `${startTime} --> ${endTime}\n${segment.title}\n`;
      })
      .join('\n');
    
    return header + cues;
  }

  private importFromJSON(content: string): Project {
    try {
      const project = JSON.parse(content);
      
      // Basic validation
      if (!project.id || !project.name || !Array.isArray(project.segments)) {
        throw new ValidationError(this.serviceName, 'json', content, 'valid project JSON');
      }

      // Convert date strings back to Date objects
      if (project.metadata) {
        project.metadata.createdAt = new Date(project.metadata.createdAt);
        project.metadata.updatedAt = new Date(project.metadata.updatedAt);
        project.metadata.lastAccessedAt = new Date(project.metadata.lastAccessedAt);
      }

      return project;
    } catch (error) {
      if (error instanceof ValidationError) throw error;
      throw new ServiceError('Invalid JSON format', this.serviceName, 'INVALID_JSON', error as Error);
    }
  }

  private sanitizeFilename(filename: string): string {
    return filename.replace(/[^a-z0-9\-_\.]/gi, '_');
  }

  private formatTime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  private formatSRTTime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const sec = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')},${ms.toString().padStart(3, '0')}`;
  }

  private formatVTTTime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const sec = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
  }

  private async readFile(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new ServiceError('Failed to read file', this.serviceName, 'FILE_READ_ERROR'));
      reader.readAsText(file);
    });
  }

  private createTestProject(): Project {
    return {
      id: 'test',
      name: 'Test Project',
      videoUrl: 'test',
      segments: [],
      queue: [],
      settings: {
        autoSave: true,
        autoSaveInterval: 300,
        defaultVolume: 50,
        playbackRate: 1.0,
        theme: 'light',
        visibility: 'private'
      },
      metadata: {
        createdAt: new Date(),
        updatedAt: new Date(),
        lastAccessedAt: new Date(),
        version: '1.0.0'
      }
    };
  }
}

// Factory function
export const createProjectExportService = (): ProjectExportService => {
  return new ProjectExportServiceImpl();
};

// Singleton instance
let instance: ProjectExportService | null = null;
export const getProjectExportService = (): ProjectExportService => {
  if (!instance) {
    instance = createProjectExportService();
  }
  return instance;
}; 