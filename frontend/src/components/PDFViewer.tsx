import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { documentsApi } from '../services/api'
import toast from 'react-hot-toast'
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Download,
  Share2,
  Heart,
  MessageSquare,
  X,
  Plus,
  Trash2,
  Maximize2,
  Minimize2,
  Loader2,
} from 'lucide-react'

interface Note {
  id: number
  content: string
  page_number?: number
  created_at: string
}

interface Document {
  id: number
  title: string
  original_filename: string
  file_size: number
  year?: number
  hospital?: string
  doctor?: string
  is_favorite: boolean
  note_count: number
}

interface PDFViewerProps {
  documentId: number | null
  onClose: () => void
}

function PDFViewer({ documentId, onClose }: PDFViewerProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [currentPage, setCurrentPage] = useState(1)
  const [scale, setScale] = useState(1.0)
  const [rotation, setRotation] = useState(0)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showNotes, setShowNotes] = useState(false)
  const [newNote, setNewNote] = useState('')
  const [notePage, setNotePage] = useState<number | undefined>(undefined)
  const [numPages, setNumPages] = useState(0)

  // Fetch document details
  const { data: document, isLoading: isLoadingDoc } = useQuery({
    queryKey: ['document', documentId],
    queryFn: () => documentsApi.get(documentId!).then((res) => res.data),
    enabled: !!documentId,
  })

  // Fetch notes
  const { data: notes, isLoading: isLoadingNotes } = useQuery({
    queryKey: ['notes', documentId],
    queryFn: () => documentsApi.getNotes(documentId!).then((res) => res.data),
    enabled: !!documentId && showNotes,
  })

  // Toggle favorite mutation
  const toggleFavoriteMutation = useMutation({
    mutationFn: () => documentsApi.toggleFavorite(documentId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['document', documentId] })
      queryClient.invalidateQueries({ queryKey: ['documentTree'] })
      toast.success(document?.is_favorite ? t('documents.unfavorite') : t('documents.favorite'))
    },
    onError: () => {
      toast.error(t('common.error'))
    },
  })

  // Create note mutation
  const createNoteMutation = useMutation({
    mutationFn: ({ content, pageNumber }: { content: string; pageNumber?: number }) =>
      documentsApi.createNote(documentId!, content, pageNumber),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes', documentId] })
      queryClient.invalidateQueries({ queryKey: ['document', documentId] })
      setNewNote('')
      setNotePage(undefined)
      toast.success(t('documents.addNote'))
    },
    onError: () => {
      toast.error(t('common.error'))
    },
  })

  // Delete note mutation
  const deleteNoteMutation = useMutation({
    mutationFn: (noteId: number) => documentsApi.deleteNote(documentId!, noteId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes', documentId] })
      queryClient.invalidateQueries({ queryKey: ['document', documentId] })
      toast.success(t('common.success'))
    },
    onError: () => {
      toast.error(t('common.error'))
    },
  })

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1)
    }
  }

  const handleNextPage = () => {
    if (currentPage < numPages) {
      setCurrentPage(currentPage + 1)
    }
  }

  const handleZoomIn = () => {
    setScale((prev) => Math.min(prev + 0.25, 3.0))
  }

  const handleZoomOut = () => {
    setScale((prev) => Math.max(prev - 0.25, 0.5))
  }

  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360)
  }

  const handleDownload = () => {
    if (documentId) {
      window.open(documentsApi.view(documentId), '_blank')
    }
  }

  const handleAddNote = () => {
    if (newNote.trim()) {
      createNoteMutation.mutate({ content: newNote.trim(), pageNumber: notePage })
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  if (!documentId) {
    return (
      <div className="h-full flex items-center justify-center text-gray-500 dark:text-gray-400">
        <div className="text-center">
          <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">📄</span>
          </div>
          <p>{t('documents.noDocuments')}</p>
          <p className="text-sm mt-2">{t('documents.selectDocument')}</p>
        </div>
      </div>
    )
  }

  if (isLoadingDoc) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-medical-600" />
      </div>
    )
  }

  const pdfUrl = documentsApi.view(documentId)

  return (
    <div className={`flex flex-col h-full bg-white dark:bg-gray-800 rounded-xl overflow-hidden shadow-lg ${isFullscreen ? 'fixed inset-0 z-50' : ''}`}>
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
        {/* Document Info */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onClose}
            className="p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <h3 className="font-medium text-gray-900 dark:text-white truncate">
              {document?.title}
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {document?.year && <span>{document.year} • </span>}
              {document?.hospital && <span>{document.hospital} • </span>}
              <span>{formatFileSize(document?.file_size || 0)}</span>
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => toggleFavoriteMutation.mutate()}
            className={`p-2 rounded-lg transition-colors ${
              document?.is_favorite
                ? 'text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20'
                : 'text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700'
            }`}
            title={document?.is_favorite ? t('documents.unfavorite') : t('documents.favorite')}
          >
            <Heart className={`w-5 h-5 ${document?.is_favorite ? 'fill-current' : ''}`} />
          </button>
          <button
            onClick={() => setShowNotes(!showNotes)}
            className={`p-2 rounded-lg transition-colors ${
              showNotes
                ? 'text-medical-600 bg-medical-50 dark:bg-medical-900/20'
                : 'text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700'
            }`}
            title={t('documents.notes')}
          >
            <MessageSquare className="w-5 h-5" />
            {document?.note_count > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-medical-600 text-white text-xs rounded-full flex items-center justify-center">
                {document.note_count}
              </span>
            )}
          </button>
          <button
            onClick={handleDownload}
            className="p-2 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700 rounded-lg transition-colors"
            title={t('common.download')}
          >
            <Download className="w-5 h-5" />
          </button>
          <div className="w-px h-6 bg-gray-200 dark:bg-gray-700 mx-1" />
          <button
            onClick={handleZoomOut}
            className="p-2 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700 rounded-lg transition-colors"
            title="Zoom out"
          >
            <ZoomOut className="w-5 h-5" />
          </button>
          <span className="text-sm text-gray-600 dark:text-gray-400 min-w-[60px] text-center">
            {Math.round(scale * 100)}%
          </span>
          <button
            onClick={handleZoomIn}
            className="p-2 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700 rounded-lg transition-colors"
            title="Zoom in"
          >
            <ZoomIn className="w-5 h-5" />
          </button>
          <button
            onClick={handleRotate}
            className="p-2 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700 rounded-lg transition-colors"
            title="Rotate"
          >
            <RotateCw className="w-5 h-5" />
          </button>
          <div className="w-px h-6 bg-gray-200 dark:bg-gray-700 mx-1" />
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-2 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700 rounded-lg transition-colors"
            title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          >
            {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* PDF Viewer */}
        <div className="flex-1 overflow-auto bg-gray-100 dark:bg-gray-900 p-4">
          <div
            className="mx-auto bg-white shadow-lg"
            style={{
              transform: `scale(${scale}) rotate(${rotation}deg)`,
              transformOrigin: 'center top',
              transition: 'transform 0.2s ease',
            }}
          >
            <iframe
              src={`${pdfUrl}#page=${currentPage}`}
              className="w-full h-[800px] border-0"
              title={document?.title}
            />
          </div>
        </div>

        {/* Notes Panel */}
        {showNotes && (
          <div className="w-80 border-l border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex flex-col">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <h4 className="font-medium text-gray-900 dark:text-white">{t('documents.notes')}</h4>
            </div>

            {/* Add Note */}
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <textarea
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder={t('documents.addNote')}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white resize-none focus:ring-2 focus:ring-medical-500"
                rows={3}
              />
              <div className="flex items-center justify-between mt-2">
                <input
                  type="number"
                  value={notePage || ''}
                  onChange={(e) => setNotePage(e.target.value ? parseInt(e.target.value) : undefined)}
                  placeholder="Page #"
                  className="w-20 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                />
                <button
                  onClick={handleAddNote}
                  disabled={!newNote.trim() || createNoteMutation.isPending}
                  className="flex items-center gap-1 px-3 py-1.5 bg-medical-600 text-white text-sm rounded-lg hover:bg-medical-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {createNoteMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4" />
                  )}
                  {t('common.add')}
                </button>
              </div>
            </div>

            {/* Notes List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {isLoadingNotes ? (
                <div className="text-center text-gray-500 dark:text-gray-400">
                  <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                </div>
              ) : notes && notes.length > 0 ? (
                notes.map((note: Note) => (
                  <div
                    key={note.id}
                    className="p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
                  >
                    <p className="text-sm text-gray-700 dark:text-gray-300">{note.content}</p>
                    {note.page_number && (
                      <p className="text-xs text-medical-600 dark:text-medical-400 mt-1">
                        Page {note.page_number}
                      </p>
                    )}
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-xs text-gray-400">
                        {new Date(note.created_at).toLocaleDateString()}
                      </span>
                      <button
                        onClick={() => deleteNoteMutation.mutate(note.id)}
                        className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-center text-gray-500 dark:text-gray-400 text-sm">
                  {t('documents.noNotes')}
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Page Navigation */}
      <div className="flex items-center justify-center gap-4 px-4 py-2 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
        <button
          onClick={handlePrevPage}
          disabled={currentPage <= 1}
          className="p-1.5 text-gray-500 hover:bg-gray-200 dark:text-gray-400 dark:hover:bg-gray-700 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <span className="text-sm text-gray-600 dark:text-gray-400">
          Page {currentPage} of {numPages || '?'}
        </span>
        <button
          onClick={handleNextPage}
          disabled={currentPage >= numPages}
          className="p-1.5 text-gray-500 hover:bg-gray-200 dark:text-gray-400 dark:hover:bg-gray-700 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  )
}

export default PDFViewer
