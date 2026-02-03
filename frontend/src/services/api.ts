import axios from 'axios'

// API base URL
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

// Create axios instance
export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
})

// Request interceptor
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('auth-storage')
    if (token) {
      try {
        const parsed = JSON.parse(token)
        if (parsed.state?.token) {
          config.headers.Authorization = `Bearer ${parsed.state.token}`
        }
      } catch (e) {
        console.error('Error parsing auth token:', e)
      }
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Response interceptor
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Clear auth state on 401
      localStorage.removeItem('auth-storage')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

// Document API
export const documentsApi = {
  // Get document tree
  getTree: () => api.get('/documents/tree'),

  // List documents
  list: (params?: { skip?: number; limit?: number; year?: number; hospital?: string }) =>
    api.get('/documents/', { params }),

  // Get single document
  get: (id: number) => api.get(`/documents/${id}`),

  // Upload document
  upload: (file: File, metadata?: Record<string, any>) => {
    const formData = new FormData()
    formData.append('file', file)
    if (metadata) {
      Object.entries(metadata).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          formData.append(key, String(value))
        }
      })
    }
    return api.post('/documents/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },

  // Update document
  update: (id: number, data: Record<string, any>) =>
    api.put(`/documents/${id}`, data),

  // Delete document
  delete: (id: number) => api.delete(`/documents/${id}`),

  // Toggle favorite
  toggleFavorite: (id: number) => api.post(`/documents/${id}/favorite`),

  // Search documents
  search: (query: string, filters?: { year?: number; hospital?: string }) =>
    api.get('/documents/search', { params: { q: query, ...filters } }),

  // Get document file
  view: (id: number) => `${API_URL}/documents/${id}/view`,

  // Notes
  getNotes: (id: number) => api.get(`/documents/${id}/notes`),
  createNote: (id: number, content: string, pageNumber?: number) =>
    api.post(`/documents/${id}/notes`, { content, page_number: pageNumber }),
  deleteNote: (documentId: number, noteId: number) =>
    api.delete(`/documents/${documentId}/notes/${noteId}`),

  // Share links
  createShareLink: (id: number, data: { expires_in_days?: number; max_views?: number }) =>
    api.post(`/documents/${id}/share`, data),
  revokeShareLink: (documentId: number, shareId: number) =>
    api.delete(`/documents/${documentId}/share/${shareId}`),
}

// Notifications API
export const notificationsApi = {
  list: () => api.get('/notifications/'),
  markAsRead: (id: number) => api.post(`/notifications/${id}/read`),
  markAllAsRead: () => api.post('/notifications/read-all'),
  delete: (id: number) => api.delete(`/notifications/${id}`),
}

export default api
