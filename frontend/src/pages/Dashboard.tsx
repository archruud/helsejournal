import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useDropzone } from 'react-dropzone'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { documentsApi } from '../services/api'
import PDFViewer from '../components/PDFViewer'
import toast from 'react-hot-toast'
import {
  Upload,
  X,
  FileText,
  Loader2,
  Calendar,
  Building2,
  User,
  Tag,
  Check,
} from 'lucide-react'

interface UploadModalProps {
  isOpen: boolean
  onClose: () => void
}

function UploadModal({ isOpen, onClose }: UploadModalProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [files, setFiles] = useState<File[]>([])
  const [metadata, setMetadata] = useState<Record<string, any>>({})

  const uploadMutation = useMutation({
    mutationFn: async ({ file, meta }: { file: File; meta: Record<string, any> }) => {
      return documentsApi.upload(file, meta)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documentTree'] })
      toast.success(t('documents.uploadSuccess') || 'Document uploaded successfully')
      setFiles([])
      setMetadata({})
      onClose()
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || t('common.error'))
    },
  })

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setFiles((prev) => [...prev, ...acceptedFiles])
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
    },
    multiple: true,
  })

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const handleUpload = async () => {
    for (const file of files) {
      await uploadMutation.mutateAsync({ file, meta: metadata })
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            {t('documents.uploadDocument')}
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {/* Dropzone */}
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
              isDragActive
                ? 'border-medical-500 bg-medical-50 dark:bg-medical-900/20'
                : 'border-gray-300 dark:border-gray-600 hover:border-medical-400 dark:hover:border-medical-500'
            }`}
          >
            <input {...getInputProps()} />
            <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-400">
              {t('documents.dragDrop')}
            </p>
            <p className="text-sm text-gray-400 mt-2">PDF files only</p>
          </div>

          {/* File List */}
          {files.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                Selected files ({files.length})
              </h3>
              <div className="space-y-2">
                {files.map((file, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <FileText className="w-5 h-5 text-medical-500" />
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {file.name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {(file.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => removeFile(index)}
                      className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Metadata Form */}
          {files.length > 0 && (
            <div className="mt-6 grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  <Calendar className="w-4 h-4 inline mr-1" />
                  {t('documents.year')}
                </label>
                <input
                  type="number"
                  value={metadata.year || ''}
                  onChange={(e) =>
                    setMetadata({ ...metadata, year: parseInt(e.target.value) || undefined })
                  }
                  placeholder="2024"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  <Building2 className="w-4 h-4 inline mr-1" />
                  {t('documents.hospital')}
                </label>
                <input
                  type="text"
                  value={metadata.hospital || ''}
                  onChange={(e) => setMetadata({ ...metadata, hospital: e.target.value })}
                  placeholder="Hospital name"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  <User className="w-4 h-4 inline mr-1" />
                  {t('documents.doctor')}
                </label>
                <input
                  type="text"
                  value={metadata.doctor || ''}
                  onChange={(e) => setMetadata({ ...metadata, doctor: e.target.value })}
                  placeholder="Doctor name"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  <Tag className="w-4 h-4 inline mr-1" />
                  {t('documents.documentType')}
                </label>
                <select
                  value={metadata.document_type || ''}
                  onChange={(e) => setMetadata({ ...metadata, document_type: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                >
                  <option value="">Select type</option>
                  <option value="lab">Lab Results</option>
                  <option value="prescription">Prescription</option>
                  <option value="report">Medical Report</option>
                  <option value="imaging">Imaging</option>
                  <option value="referral">Referral</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={handleUpload}
            disabled={files.length === 0 || uploadMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 bg-medical-600 hover:bg-medical-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {uploadMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {t('common.loading')}
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                {t('documents.uploadDocument')}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

function Dashboard() {
  const { t } = useTranslation()
  const [selectedDocument, setSelectedDocument] = useState<number | null>(null)
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false)

  // Listen for document selection events from sidebar
  useEffect(() => {
    const handleSelectDocument = (event: CustomEvent<{ id: number }>) => {
      setSelectedDocument(event.detail.id)
    }

    const handleOpenUploadModal = () => {
      setIsUploadModalOpen(true)
    }

    window.addEventListener('selectDocument', handleSelectDocument as EventListener)
    window.addEventListener('openUploadModal', handleOpenUploadModal)

    return () => {
      window.removeEventListener('selectDocument', handleSelectDocument as EventListener)
      window.removeEventListener('openUploadModal', handleOpenUploadModal)
    }
  }, [])

  return (
    <div className="h-[calc(100vh-6rem)]">
      {/* Welcome Message */}
      {!selectedDocument && (
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            {t('navigation.dashboard')}
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Welcome to your personal health journal. Select a document from the sidebar to view.
          </p>
        </div>
      )}

      {/* PDF Viewer */}
      <div className="h-full">
        <PDFViewer
          documentId={selectedDocument}
          onClose={() => setSelectedDocument(null)}
        />
      </div>

      {/* Upload Modal */}
      <UploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
      />
    </div>
  )
}

export default Dashboard
