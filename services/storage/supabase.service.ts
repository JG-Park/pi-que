import {
  SupabaseService as ISupabaseService,
  SignInCredentials,
  AuthResult,
  User,
  Session,
  Project,
  OfflineChange,
  SyncResult,
  SyncConflict,
  SyncError,
  UploadResult,
  PaginatedResponse,
  SearchOptions,
  ServiceError,
  ValidationError,
  NotFoundError
} from '../../types/services';

// Mock Supabase implementation for development
// In production, you would import and use the actual Supabase client
interface MockSupabaseClient {
  auth: {
    signInWithPassword: (credentials: { email: string; password: string }) => Promise<any>;
    signOut: () => Promise<any>;
    getUser: () => Promise<any>;
    onAuthStateChange: (callback: (event: string, session: any) => void) => { unsubscribe: () => void };
  };
  from: (table: string) => any;
  storage: {
    from: (bucket: string) => any;
  };
  channel: (topic: string) => any;
}

export class SupabaseService implements ISupabaseService {
  readonly serviceName = 'SupabaseService';
  readonly version = '1.0.0';
  
  private client: MockSupabaseClient | null = null;
  private currentUser: User | null = null;
  private currentSession: Session | null = null;
  private offlineChanges: OfflineChange[] = [];
  private subscriptions: Map<string, () => void> = new Map();
  
  constructor() {
    this.initializeClient();
    this.loadOfflineChanges();
  }

  async isHealthy(): Promise<boolean> {
    try {
      // Check if Supabase client is available and can connect
      if (!this.client) {
        return false;
      }
      
      // Try to get current user (this should work even without authentication)
      await this.client.auth.getUser();
      return true;
    } catch {
      return false;
    }
  }

  async signIn(credentials: SignInCredentials): Promise<AuthResult> {
    this.validateSignInCredentials(credentials);
    
    if (!this.client) {
      throw new ServiceError('Supabase client not initialized', 'SupabaseService', 'CLIENT_NOT_INITIALIZED');
    }

    try {
      const { data, error } = await this.client.auth.signInWithPassword({
        email: credentials.email,
        password: credentials.password
      });

      if (error) {
        throw new ServiceError(`Authentication failed: ${error.message}`, 'SupabaseService', 'AUTH_ERROR');
      }

      if (!data.user || !data.session) {
        throw new ServiceError('Invalid authentication response', 'SupabaseService', 'AUTH_INVALID_RESPONSE');
      }

      // Convert Supabase user/session to our types
      this.currentUser = this.convertSupabaseUser(data.user);
      this.currentSession = this.convertSupabaseSession(data.session);

      return {
        user: this.currentUser,
        session: this.currentSession
      };
    } catch (error) {
      if (error instanceof ServiceError) throw error;
      throw new ServiceError('Failed to sign in', 'SupabaseService', 'SIGNIN_ERROR', error as Error);
    }
  }

  async signOut(): Promise<void> {
    if (!this.client) {
      throw new ServiceError('Supabase client not initialized', 'SupabaseService', 'CLIENT_NOT_INITIALIZED');
    }

    try {
      const { error } = await this.client.auth.signOut();
      
      if (error) {
        throw new ServiceError(`Sign out failed: ${error.message}`, 'SupabaseService', 'SIGNOUT_ERROR');
      }

      this.currentUser = null;
      this.currentSession = null;
      
      // Clean up subscriptions
      this.subscriptions.forEach(unsubscribe => unsubscribe());
      this.subscriptions.clear();
    } catch (error) {
      if (error instanceof ServiceError) throw error;
      throw new ServiceError('Failed to sign out', 'SupabaseService', 'SIGNOUT_ERROR', error as Error);
    }
  }

  async getCurrentUser(): Promise<User | null> {
    if (!this.client) {
      return null;
    }

    try {
      if (this.currentUser) {
        return this.currentUser;
      }

      const { data } = await this.client.auth.getUser();
      
      if (data.user) {
        this.currentUser = this.convertSupabaseUser(data.user);
        return this.currentUser;
      }

      return null;
    } catch (error) {
      console.warn('Failed to get current user:', error);
      return null;
    }
  }

  async syncProject(project: Project): Promise<Project> {
    this.requireAuthentication();
    
    if (!this.client) {
      throw new ServiceError('Supabase client not initialized', 'SupabaseService', 'CLIENT_NOT_INITIALIZED');
    }

    try {
      const { data, error } = await this.client
        .from('projects')
        .upsert({
          id: project.id,
          name: project.name,
          description: project.description,
          video_url: project.videoUrl,
          video_info: project.videoInfo,
          segments: project.segments,
          queue: project.queue,
          settings: project.settings,
          metadata: project.metadata,
          user_id: this.currentUser!.id,
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        throw new ServiceError(`Failed to sync project: ${error.message}`, 'SupabaseService', 'SYNC_ERROR');
      }

      return this.convertSupabaseProject(data);
    } catch (error) {
      // Store as offline change if sync fails
      await this.addOfflineChange('update', 'project', project.id, project);
      
      if (error instanceof ServiceError) throw error;
      throw new ServiceError('Failed to sync project', 'SupabaseService', 'SYNC_ERROR', error as Error);
    }
  }

  async fetchProject(id: string): Promise<Project> {
    this.requireAuthentication();
    this.validateProjectId(id);
    
    if (!this.client) {
      throw new ServiceError('Supabase client not initialized', 'SupabaseService', 'CLIENT_NOT_INITIALIZED');
    }

    try {
      const { data, error } = await this.client
        .from('projects')
        .select('*')
        .eq('id', id)
        .eq('user_id', this.currentUser!.id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          throw new NotFoundError('SupabaseService', 'Project', id);
        }
        throw new ServiceError(`Failed to fetch project: ${error.message}`, 'SupabaseService', 'FETCH_ERROR');
      }

      return this.convertSupabaseProject(data);
    } catch (error) {
      if (error instanceof NotFoundError || error instanceof ServiceError) throw error;
      throw new ServiceError('Failed to fetch project', 'SupabaseService', 'FETCH_ERROR', error as Error);
    }
  }

  async deleteRemoteProject(id: string): Promise<void> {
    this.requireAuthentication();
    this.validateProjectId(id);
    
    if (!this.client) {
      throw new ServiceError('Supabase client not initialized', 'SupabaseService', 'CLIENT_NOT_INITIALIZED');
    }

    try {
      const { error } = await this.client
        .from('projects')
        .delete()
        .eq('id', id)
        .eq('user_id', this.currentUser!.id);

      if (error) {
        throw new ServiceError(`Failed to delete project: ${error.message}`, 'SupabaseService', 'DELETE_ERROR');
      }
    } catch (error) {
      // Store as offline change if delete fails
      await this.addOfflineChange('delete', 'project', id, null);
      
      if (error instanceof ServiceError) throw error;
      throw new ServiceError('Failed to delete remote project', 'SupabaseService', 'DELETE_ERROR', error as Error);
    }
  }

  async getUserProjects(userId: string, options?: SearchOptions): Promise<PaginatedResponse<Project>> {
    this.requireAuthentication();
    
    if (!this.client) {
      throw new ServiceError('Supabase client not initialized', 'SupabaseService', 'CLIENT_NOT_INITIALIZED');
    }

    try {
      let query = this.client
        .from('projects')
        .select('*', { count: 'exact' })
        .eq('user_id', userId);

      // Apply search filters
      if (options?.filters?.query) {
        query = query.or(`name.ilike.%${options.filters.query}%,description.ilike.%${options.filters.query}%`);
      }

      // Apply sorting
      if (options?.sortBy) {
        const order = options.sortOrder || 'asc';
        query = query.order(options.sortBy, { ascending: order === 'asc' });
      } else {
        query = query.order('updated_at', { ascending: false });
      }

      // Apply pagination
      const page = options?.page || 1;
      const pageSize = options?.pageSize || 10;
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      
      query = query.range(from, to);

      const { data, error, count } = await query;

      if (error) {
        throw new ServiceError(`Failed to get user projects: ${error.message}`, 'SupabaseService', 'FETCH_ERROR');
      }

      const projects = data.map(this.convertSupabaseProject);
      const totalItems = count || 0;
      const totalPages = Math.ceil(totalItems / pageSize);

      return {
        items: projects,
        pagination: {
          page,
          pageSize,
          totalItems,
          totalPages,
          hasNext: page < totalPages,
          hasPrevious: page > 1
        }
      };
    } catch (error) {
      if (error instanceof ServiceError) throw error;
      throw new ServiceError('Failed to get user projects', 'SupabaseService', 'FETCH_ERROR', error as Error);
    }
  }

  async subscribeToProjectChanges(projectId: string, callback: (project: Project) => void): Promise<() => void> {
    this.requireAuthentication();
    this.validateProjectId(projectId);
    
    if (!this.client) {
      throw new ServiceError('Supabase client not initialized', 'SupabaseService', 'CLIENT_NOT_INITIALIZED');
    }

    try {
      const channel = this.client
        .channel(`project-${projectId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'projects',
            filter: `id=eq.${projectId}`
          },
          (payload) => {
            if (payload.new) {
              const project = this.convertSupabaseProject(payload.new);
              callback(project);
            }
          }
        )
        .subscribe();

      const unsubscribe = () => {
        this.client?.channel(`project-${projectId}`).unsubscribe();
        this.subscriptions.delete(projectId);
      };

      this.subscriptions.set(projectId, unsubscribe);
      return unsubscribe;
    } catch (error) {
      throw new ServiceError('Failed to subscribe to project changes', 'SupabaseService', 'SUBSCRIPTION_ERROR', error as Error);
    }
  }

  async getOfflineChanges(): Promise<OfflineChange[]> {
    return [...this.offlineChanges];
  }

  async syncOfflineChanges(): Promise<SyncResult> {
    if (!this.currentUser) {
      throw new ServiceError('User must be authenticated to sync offline changes', 'SupabaseService', 'AUTH_REQUIRED');
    }

    const result: SyncResult = {
      success: true,
      syncedChanges: 0,
      conflicts: [],
      errors: []
    };

    for (const change of this.offlineChanges) {
      try {
        await this.processOfflineChange(change);
        result.syncedChanges++;
      } catch (error) {
        result.errors.push({
          changeId: change.id,
          error: (error as Error).message,
          retryable: true
        });
        result.success = false;
      }
    }

    // Remove successfully synced changes
    if (result.syncedChanges > 0) {
      this.offlineChanges = this.offlineChanges.slice(result.syncedChanges);
      await this.saveOfflineChanges();
    }

    return result;
  }

  async uploadFile(file: File, path: string): Promise<UploadResult> {
    this.requireAuthentication();
    
    if (!this.client) {
      throw new ServiceError('Supabase client not initialized', 'SupabaseService', 'CLIENT_NOT_INITIALIZED');
    }

    try {
      const { data, error } = await this.client.storage
        .from('user-files')
        .upload(path, file);

      if (error) {
        throw new ServiceError(`Failed to upload file: ${error.message}`, 'SupabaseService', 'UPLOAD_ERROR');
      }

      const { data: urlData } = this.client.storage
        .from('user-files')
        .getPublicUrl(data.path);

      return {
        path: data.path,
        url: urlData.publicUrl,
        size: file.size,
        mimeType: file.type
      };
    } catch (error) {
      if (error instanceof ServiceError) throw error;
      throw new ServiceError('Failed to upload file', 'SupabaseService', 'UPLOAD_ERROR', error as Error);
    }
  }

  async deleteFile(path: string): Promise<void> {
    this.requireAuthentication();
    
    if (!this.client) {
      throw new ServiceError('Supabase client not initialized', 'SupabaseService', 'CLIENT_NOT_INITIALIZED');
    }

    try {
      const { error } = await this.client.storage
        .from('user-files')
        .remove([path]);

      if (error) {
        throw new ServiceError(`Failed to delete file: ${error.message}`, 'SupabaseService', 'DELETE_FILE_ERROR');
      }
    } catch (error) {
      if (error instanceof ServiceError) throw error;
      throw new ServiceError('Failed to delete file', 'SupabaseService', 'DELETE_FILE_ERROR', error as Error);
    }
  }

  async getFileUrl(path: string): Promise<string> {
    if (!this.client) {
      throw new ServiceError('Supabase client not initialized', 'SupabaseService', 'CLIENT_NOT_INITIALIZED');
    }

    try {
      const { data } = this.client.storage
        .from('user-files')
        .getPublicUrl(path);

      return data.publicUrl;
    } catch (error) {
      throw new ServiceError('Failed to get file URL', 'SupabaseService', 'GET_FILE_URL_ERROR', error as Error);
    }
  }

  // Private helper methods
  private initializeClient(): void {
    // In a real implementation, you would initialize the Supabase client here
    // For now, we'll create a mock client
    this.client = {
      auth: {
        signInWithPassword: async (credentials) => ({
          data: {
            user: { id: 'mock-user-id', email: credentials.email },
            session: { access_token: 'mock-token', refresh_token: 'mock-refresh' }
          },
          error: null
        }),
        signOut: async () => ({ error: null }),
        getUser: async () => ({ data: { user: null }, error: null }),
        onAuthStateChange: (callback) => ({ unsubscribe: () => {} })
      },
      from: (table: string) => ({
        select: () => ({ eq: () => ({ single: async () => ({ data: null, error: { code: 'PGRST116' } }) }) }),
        upsert: () => ({ select: () => ({ single: async () => ({ data: {}, error: null }) }) }),
        delete: () => ({ eq: () => ({ eq: async () => ({ error: null }) }) })
      }),
      storage: {
        from: (bucket: string) => ({
          upload: async () => ({ data: { path: 'mock-path' }, error: null }),
          remove: async () => ({ error: null }),
          getPublicUrl: () => ({ data: { publicUrl: 'https://mock-url.com' } })
        })
      },
      channel: (topic: string) => ({
        on: () => ({ subscribe: () => {} }),
        unsubscribe: () => {}
      })
    };
  }

  private requireAuthentication(): void {
    if (!this.currentUser) {
      throw new ServiceError('User must be authenticated', 'SupabaseService', 'AUTH_REQUIRED');
    }
  }

  private validateSignInCredentials(credentials: SignInCredentials): void {
    if (!credentials.email || !credentials.password) {
      throw new ValidationError('SupabaseService', 'credentials', credentials, 'email and password required');
    }

    if (!this.isValidEmail(credentials.email)) {
      throw new ValidationError('SupabaseService', 'email', credentials.email, 'valid email address');
    }
  }

  private validateProjectId(id: string): void {
    if (!id || typeof id !== 'string') {
      throw new ValidationError('SupabaseService', 'projectId', id, 'non-empty string');
    }
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  private convertSupabaseUser(supabaseUser: any): User {
    return {
      id: supabaseUser.id,
      email: supabaseUser.email,
      name: supabaseUser.user_metadata?.name,
      avatar: supabaseUser.user_metadata?.avatar_url,
      createdAt: new Date(supabaseUser.created_at),
      updatedAt: new Date(supabaseUser.updated_at)
    };
  }

  private convertSupabaseSession(supabaseSession: any): Session {
    return {
      accessToken: supabaseSession.access_token,
      refreshToken: supabaseSession.refresh_token,
      expiresAt: new Date(supabaseSession.expires_at * 1000)
    };
  }

  private convertSupabaseProject(supabaseProject: any): Project {
    return {
      id: supabaseProject.id,
      name: supabaseProject.name,
      description: supabaseProject.description,
      videoUrl: supabaseProject.video_url,
      videoInfo: supabaseProject.video_info,
      segments: supabaseProject.segments || [],
      queue: supabaseProject.queue || [],
      settings: supabaseProject.settings,
      metadata: {
        ...supabaseProject.metadata,
        createdAt: new Date(supabaseProject.created_at),
        updatedAt: new Date(supabaseProject.updated_at)
      }
    };
  }

  private async addOfflineChange(type: 'create' | 'update' | 'delete', entity: 'project' | 'segment' | 'queue', entityId: string, data: any): Promise<void> {
    const change: OfflineChange = {
      id: `offline-${Date.now()}-${Math.random()}`,
      type,
      entity,
      entityId,
      data,
      timestamp: new Date()
    };

    this.offlineChanges.push(change);
    await this.saveOfflineChanges();
  }

  private async processOfflineChange(change: OfflineChange): Promise<void> {
    switch (change.entity) {
      case 'project':
        if (change.type === 'update' || change.type === 'create') {
          await this.syncProject(change.data);
        } else if (change.type === 'delete') {
          await this.deleteRemoteProject(change.entityId);
        }
        break;
      default:
        throw new ServiceError(`Unsupported offline change entity: ${change.entity}`, 'SupabaseService', 'UNSUPPORTED_ENTITY');
    }
  }

  private async loadOfflineChanges(): Promise<void> {
    try {
      const stored = localStorage.getItem('pi-que-offline-changes');
      if (stored) {
        const changes = JSON.parse(stored);
        this.offlineChanges = changes.map((change: any) => ({
          ...change,
          timestamp: new Date(change.timestamp)
        }));
      }
    } catch (error) {
      console.warn('Failed to load offline changes:', error);
    }
  }

  private async saveOfflineChanges(): Promise<void> {
    try {
      localStorage.setItem('pi-que-offline-changes', JSON.stringify(this.offlineChanges));
    } catch (error) {
      console.warn('Failed to save offline changes:', error);
    }
  }
}

// Factory function
export const createSupabaseService = (): SupabaseService => {
  return new SupabaseService();
};

// Singleton instance
let supabaseServiceInstance: SupabaseService | null = null;

export const getSupabaseService = (): SupabaseService => {
  if (!supabaseServiceInstance) {
    supabaseServiceInstance = createSupabaseService();
  }
  return supabaseServiceInstance;
}; 