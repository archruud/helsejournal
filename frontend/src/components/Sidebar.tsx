import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { documentsApi } from '../services/api'
import {
  Folder,
  FolderOpen,
  FileText,
  ChevronRight,
  ChevronDown,
  Building2,
  UserCircle,
  Calendar,
  Star,
  Clock,
  Upload,
} from 'lucide-react'

interface TreeNode {
  id: string
  name: string
  type: 'year' | 'hospital' | 'document'
  children?: TreeNode[]
  document_id?: number
}

interface TreeItemProps {
  node: TreeNode
  level: number
  selectedDoc: number | null
  onSelectDoc: (id: number) => void
  defaultExpanded?: boolean
}

function TreeItem({ node, level, selectedDoc, onSelectDoc, defaultExpanded = false }: TreeItemProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)
  const { t } = useTranslation()

  const paddingLeft = level * 16 + 12

  const getIcon = () => {
    switch (node.type) {
      case 'year':
        return <Calendar className="w-4 h-4 text-medical-500" />
      case 'hospital':
        return <Building2 className="w-4 h-4 text-blue-500" />
      case 'document':
        return <FileText className="w-4 h-4 text-gray-500" />
      default:
        return <Folder className="w-4 h-4 text-gray-500" />
    }
  }

  if (node.type === 'document') {
    const isSelected = selectedDoc === node.document_id
    return (
      <button
        onClick={() => node.document_id && onSelectDoc(node.document_id)}
        className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm transition-colors ${
          isSelected
            ? 'bg-medical-100 dark:bg-medical-900 text-medical-900 dark:text-medical-100'
            : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
        }`}
        style={{ paddingLeft }}
      >
        {getIcon()}
        <span className="truncate">{node.name}</span>
      </button>
    )
  }

  return (
    <div>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        style={{ paddingLeft }}
      >
        {isExpanded ? (
          <ChevronDown className="w-4 h-4 text-gray-400" />
        ) : (
          <ChevronRight className="w-4 h-4 text-gray-400" />
        )}
        {getIcon()}
        <span className="truncate">{node.name}</span>
      </button>
      {isExpanded && node.children && (
        <div>
          {node.children.map((child) => (
            <TreeItem
              key={child.id}
              node={child}
              level={level + 1}
              selectedDoc={selectedDoc}
              onSelectDoc={onSelectDoc}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function Sidebar() {
  const { t } = useTranslation()
  const [selectedDoc, setSelectedDoc] = useState<number | null>(null)
  const [activeTab, setActiveTab] = useState<'tree' | 'favorites' | 'recent'>('tree')

  const { data: treeData, isLoading } = useQuery({
    queryKey: ['documentTree'],
    queryFn: () => documentsApi.getTree().then((res) => res.data),
  })

  const handleSelectDoc = (id: number) => {
    setSelectedDoc(id)
    // Emit event for PDF viewer
    window.dispatchEvent(new CustomEvent('selectDocument', { detail: { id } }))
  }

  return (
    <div className="h-full flex flex-col">
      {/* Navigation Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setActiveTab('tree')}
          className={`flex-1 py-3 text-sm font-medium transition-colors ${
            activeTab === 'tree'
              ? 'text-medical-600 dark:text-medical-400 border-b-2 border-medical-600'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          <FolderOpen className="w-4 h-4 mx-auto" />
        <span className="text-xs mt-1">{t('tree.documents')}</span>
        </button>
        <button
          onClick={() => setActiveTab('favorites')}
          className={`flex-1 py-3 text-sm font-medium transition-colors ${
            activeTab === 'favorites'
              ? 'text-medical-600 dark:text-medical-400 border-b-2 border-medical-600'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          <Star className="w-4 h-4 mx-auto" />
          <span className="text-xs mt-1">{t('navigation.favorites')}</span>
        </button>
        <button
          onClick={() => setActiveTab('recent')}
          className={`flex-1 py-3 text-sm font-medium transition-colors ${
            activeTab === 'recent'
              ? 'text-medical-600 dark:text-medical-400 border-b-2 border-medical-600'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          <Clock className="w-4 h-4 mx-auto" />
          <span className="text-xs mt-1">{t('navigation.recent')}</span>
        </button>
      </div>

      {/* Upload Button */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => window.dispatchEvent(new CustomEvent('openUploadModal'))}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-medical-600 hover:bg-medical-700 text-white rounded-lg transition-colors"
        >
          <Upload className="w-4 h-4" />
          <span className="text-sm font-medium">{t('documents.uploadDocument')}</span>
        </button>
      </div>

      {/* Tree View */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {activeTab === 'tree' && (
          <>
            {isLoading ? (
              <div className="p-4 text-center text-gray-500 dark:text-gray-400">
                <div className="animate-spin w-6 h-6 border-2 border-medical-600 border-t-transparent rounded-full mx-auto mb-2"></div>
                {t('common.loading')}
              </div>
            ) : treeData && treeData.length > 0 ? (
              <div className="py-2">
                {treeData.map((node: TreeNode) => (
                  <TreeItem
                    key={node.id}
                    node={node}
                    level={0}
                    selectedDoc={selectedDoc}
                    onSelectDoc={handleSelectDoc}
                    defaultExpanded={true}
                  />
                ))}
              </div>
            ) : (
              <div className="p-4 text-center text-gray-500 dark:text-gray-400 text-sm">
                {t('documents.noDocuments')}
              </div>
            )}
          </>
        )}

        {activeTab === 'favorites' && (
          <div className="p-4 text-center text-gray-500 dark:text-gray-400 text-sm">
            {t('documents.noDocuments')}
          </div>
        )}

        {activeTab === 'recent' && (
          <div className="p-4 text-center text-gray-500 dark:text-gray-400 text-sm">
            {t('documents.noDocuments')}
          </div>
        )}
      </div>

      {/* Quick Stats */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="text-center p-2 bg-white dark:bg-gray-800 rounded-lg">
            <div className="font-bold text-medical-600 dark:text-medical-400">
              {treeData?.reduce((acc: number, year: TreeNode) => 
                acc + (year.children?.reduce((a: number, h: TreeNode) => 
                  a + (h.children?.length || 0), 0) || 0), 0) || 0}
            </div>
            <div className="text-gray-500 dark:text-gray-400">{t('tree.documents')}</div>
          </div>
          <div className="text-center p-2 bg-white dark:bg-gray-800 rounded-lg">
            <div className="font-bold text-medical-600 dark:text-medical-400">
              {treeData?.length || 0}
            </div>
            <div className="text-gray-500 dark:text-gray-400">{t('tree.years')}</div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Sidebar
