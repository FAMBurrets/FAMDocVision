
import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Folder as FolderIcon, Play, Image as ImageIcon, X, Trash2, ChevronLeft, Edit3, LogOut, AlertCircle, User, Settings, MessageSquare, Save } from 'lucide-react';
import { Folder, ViewState, Asset } from './types';
import { useAuth } from './contexts/AuthContext';
import LoginScreen from './components/LoginScreen';
import * as db from './services/database';
import { processFiles } from './services/storage';

// --- Sub-components ---

const FileInput: React.FC<{
  label: string;
  icon: React.ReactNode;
  accept: string;
  multiple?: boolean;
  onChange: (files: FileList | null) => void;
}> = ({ label, icon, accept, multiple, onChange }) => (
  <div className="flex flex-col items-center justify-center border-2 border-dashed border-slate-300 rounded-xl p-8 hover:border-brand-red hover:bg-red-50 transition-all cursor-pointer relative group">
    <input
      type="file"
      accept={accept}
      multiple={multiple}
      onChange={(e) => onChange(e.target.files)}
      className="absolute inset-0 opacity-0 cursor-pointer z-10"
    />
    <div className="text-slate-400 group-hover:text-brand-red mb-2">
      {icon}
    </div>
    <span className="text-sm font-medium text-slate-600 group-hover:text-brand-red">{label}</span>
  </div>
);

const FolderCard: React.FC<{ folder: Folder; onClick: () => void; onDelete: (id: string) => void }> = ({ folder, onClick, onDelete }) => (
  <div
    onClick={onClick}
    className="group bg-white rounded-2xl shadow-sm border border-slate-200 p-5 hover:shadow-md hover:border-brand-red/30 transition-all cursor-pointer relative"
  >
    <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
      <button
        onClick={(e) => { e.stopPropagation(); onDelete(folder.id); }}
        className="p-2 text-slate-400 hover:text-red-500 rounded-lg hover:bg-red-50"
      >
        <Trash2 size={16} />
      </button>
    </div>
    <div className="w-14 h-14 bg-brand-navy rounded-xl flex items-center justify-center text-white mb-4">
      <FolderIcon size={28} />
    </div>
    <h3 className="font-bold text-slate-800 text-lg truncate mb-1">{folder.name}</h3>
    <div className="flex items-center gap-3 text-sm text-slate-500">
      <span className="flex items-center gap-1">
        <Play size={14} /> {folder.videos.length}
      </span>
      <span className="flex items-center gap-1">
        <ImageIcon size={14} /> {folder.images.length}
      </span>
    </div>
  </div>
);

export default function App() {
  const { user, loading, signOut } = useAuth();
  const [folders, setFolders] = useState<Folder[]>([]);
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [viewState, setViewState] = useState<ViewState>('grid');

  // Modal / Edit State
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [newFolderName, setNewFolderName] = useState('');
  const [tempVideos, setTempVideos] = useState<Asset[]>([]);
  const [tempImages, setTempImages] = useState<Asset[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [activeVideoIdx, setActiveVideoIdx] = useState(0);
  const [isLoadingFolders, setIsLoadingFolders] = useState(true);
  const [dbError, setDbError] = useState<string | null>(null);
  const [isUploadingVideos, setIsUploadingVideos] = useState(false);
  const [isUploadingImages, setIsUploadingImages] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isProfileSettingsOpen, setIsProfileSettingsOpen] = useState(false);
  const [profileDisplayName, setProfileDisplayName] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [folderNotes, setFolderNotes] = useState('');
  const [isSavingNotes, setIsSavingNotes] = useState(false);

  const loadFolders = useCallback(async () => {
    if (!user) return;

    setIsLoadingFolders(true);
    setDbError(null);

    try {
      const loadedFolders = await db.getFolders(user.id);
      setFolders(loadedFolders);
    } catch (error) {
      console.error('Failed to load folders:', error);
      setDbError('Failed to load folders from database. Make sure the database is running.');
      // Fallback to localStorage for dev
      const saved = localStorage.getItem('docuvision_folders');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          const migrated = parsed.map((f: any) => ({
            ...f,
            videos: f.videos || (f.video ? [f.video] : [])
          }));
          setFolders(migrated);
        } catch (e) {
          console.error("Failed to parse localStorage folders", e);
        }
      }
    } finally {
      setIsLoadingFolders(false);
    }
  }, [user]);

  useEffect(() => {
    loadFolders();
  }, [loadFolders]);

  // Update notes when folder changes
  useEffect(() => {
    const activeFolder = folders.find(f => f.id === activeFolderId);
    if (activeFolder) {
      setFolderNotes(activeFolder.notes || '');
    }
  }, [activeFolderId, folders]);

  // Note: localStorage backup removed - data persists in database
  // Base64 files are too large for localStorage quota

  // Show loading state while checking auth
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-red"></div>
      </div>
    );
  }

  // Show login screen if not authenticated
  if (!user) {
    return <LoginScreen />;
  }

  const handleSaveFolder = async () => {
    if (!newFolderName || !user) return alert("Please name your folder");

    setIsSaving(true);
    setDbError(null);

    try {
      if (editingFolderId) {
        const updatedFolder = await db.updateFolder(
          editingFolderId,
          newFolderName,
          tempVideos,
          tempImages
        );
        setFolders(prev => prev.map(f => f.id === editingFolderId ? updatedFolder : f));
      } else {
        const newFolder = await db.createFolder(
          user.id,
          newFolderName,
          tempVideos,
          tempImages
        );
        setFolders(prev => [newFolder, ...prev]);
      }
      resetModal();
    } catch (error) {
      console.error('Failed to save folder:', error);
      setDbError('Failed to save folder. Using local storage as fallback.');
      // Fallback to local state
      if (editingFolderId) {
        setFolders(prev => prev.map(f => f.id === editingFolderId ? {
          ...f,
          name: newFolderName,
          videos: tempVideos,
          images: tempImages
        } : f));
      } else {
        const newFolder: Folder = {
          id: Math.random().toString(36).substr(2, 9),
          name: newFolderName,
          videos: tempVideos,
          images: tempImages,
          createdAt: Date.now()
        };
        setFolders(prev => [newFolder, ...prev]);
      }
      resetModal();
    } finally {
      setIsSaving(false);
    }
  };

  const openEditModal = () => {
    const folder = folders.find(f => f.id === activeFolderId);
    if (folder) {
      setEditingFolderId(folder.id);
      setNewFolderName(folder.name);
      setTempVideos(folder.videos);
      setTempImages(folder.images);
      setIsModalOpen(true);
    }
  };

  const resetModal = () => {
    setIsModalOpen(false);
    setEditingFolderId(null);
    setNewFolderName('');
    setTempVideos([]);
    setTempImages([]);
  };

  const handleVideoUpload = async (files: FileList | null) => {
    if (files) {
      setIsUploadingVideos(true);
      try {
        const newAssets = await processFiles(Array.from(files), 'video');
        setTempVideos(prev => [...prev, ...newAssets]);
      } finally {
        setIsUploadingVideos(false);
      }
    }
  };

  const handleImagesUpload = async (files: FileList | null) => {
    if (files) {
      setIsUploadingImages(true);
      try {
        const newAssets = await processFiles(Array.from(files), 'image');
        setTempImages(prev => [...prev, ...newAssets]);
      } finally {
        setIsUploadingImages(false);
      }
    }
  };

  const handleDeleteFolder = async (id: string) => {
    if (!confirm("Are you sure you want to delete this folder?")) return;

    try {
      await db.deleteFolder(id);
      setFolders(prev => prev.filter(f => f.id !== id));
      if (activeFolderId === id) setViewState('grid');
    } catch (error) {
      console.error('Failed to delete folder:', error);
      // Fallback to local state deletion
      setFolders(prev => prev.filter(f => f.id !== id));
      if (activeFolderId === id) setViewState('grid');
    }
  };

  const activeFolder = folders.find(f => f.id === activeFolderId);

  const handleSaveNotes = async () => {
    if (!activeFolder) return;
    setIsSavingNotes(true);
    try {
      await db.updateFolderNotes(activeFolder.id, folderNotes);
      setFolders(prev => prev.map(f =>
        f.id === activeFolder.id ? { ...f, notes: folderNotes } : f
      ));
    } catch (error) {
      console.error('Failed to save notes:', error);
    } finally {
      setIsSavingNotes(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-brand-navy px-6 py-3 flex items-center justify-between sticky top-0 z-30 shadow-lg">
        <div className="flex items-center gap-4">
          <img
            src="/fam-brands-logo.webp"
            alt="Fam Brands"
            className="h-10 w-auto"
          />
          <div className="h-8 w-px bg-white/20"></div>
          <span className="text-white font-semibold text-lg">DocVision</span>
        </div>

        <div className="flex items-center gap-4">
        {viewState === 'grid' ? (
          <button
            onClick={() => setIsModalOpen(true)}
            className="bg-brand-red hover:bg-brand-red-dark text-white px-5 py-2.5 rounded-xl font-semibold flex items-center gap-2 transition-all shadow-md active:scale-95"
          >
            <Plus size={18} /> Create Folder
          </button>
        ) : (
          <div className="flex items-center gap-4">
            <button
              onClick={() => { setViewState('grid'); setActiveVideoIdx(0); }}
              className="text-slate-300 hover:text-white font-medium flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-white/10 transition-all"
            >
              <ChevronLeft size={20} /> Back
            </button>
            <button
              onClick={openEditModal}
              className="bg-white/10 border border-white/20 text-white px-4 py-2 rounded-xl font-semibold hover:bg-white/20 transition-all flex items-center gap-2"
            >
              <Edit3 size={18} /> Edit Folder
            </button>
          </div>
        )}

          {/* Profile Button */}
          <div className="relative pl-4 border-l border-white/20">
            <button
              onClick={() => setIsProfileOpen(!isProfileOpen)}
              className="flex items-center gap-2 p-2 rounded-xl hover:bg-white/10 transition-all"
            >
              <div className="w-9 h-9 bg-brand-red rounded-full flex items-center justify-center text-white">
                <User size={18} />
              </div>
            </button>

            {/* Profile Dropdown */}
            {isProfileOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setIsProfileOpen(false)}
                />
                <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-xl shadow-lg border border-slate-200 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="p-4 border-b border-slate-100 bg-slate-50">
                    <div className="font-semibold text-slate-800">
                      {user.user_metadata?.full_name || 'User'}
                    </div>
                    <div className="text-sm text-slate-500 truncate">
                      {user.email}
                    </div>
                  </div>
                  <div className="p-2">
                    <button
                      onClick={() => {
                        setIsProfileOpen(false);
                        setProfileDisplayName(user.user_metadata?.full_name || '');
                        setIsProfileSettingsOpen(true);
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 text-left text-slate-700 hover:bg-slate-100 rounded-lg transition-all"
                    >
                      <Settings size={18} className="text-slate-400" />
                      <span>Profile Settings</span>
                    </button>
                    <button
                      onClick={() => {
                        setIsProfileOpen(false);
                        signOut();
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 text-left text-red-600 hover:bg-red-50 rounded-lg transition-all"
                    >
                      <LogOut size={18} />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 p-6 lg:p-10 max-w-7xl mx-auto w-full">
        {dbError && (
          <div className="mb-6 bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-xl flex items-center gap-3">
            <AlertCircle size={20} />
            <span className="text-sm">{dbError}</span>
            <button
              onClick={() => setDbError(null)}
              className="ml-auto text-amber-600 hover:text-amber-800"
            >
              <X size={18} />
            </button>
          </div>
        )}

        {isLoadingFolders ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-red"></div>
          </div>
        ) : viewState === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {folders.map(f => (
              <FolderCard 
                key={f.id} 
                folder={f} 
                onClick={() => { setActiveFolderId(f.id); setViewState('viewing'); }} 
                onDelete={handleDeleteFolder}
              />
            ))}
            <button
              onClick={() => setIsModalOpen(true)}
              className="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-2xl p-5 hover:border-brand-red hover:bg-red-50 transition-all text-slate-400 hover:text-brand-red min-h-[160px]"
            >
              <Plus size={32} className="mb-2" />
              <span className="font-semibold">New Folder</span>
            </button>
          </div>
        ) : (
          <div className="flex flex-col h-full gap-8 animate-in slide-in-from-bottom-4 duration-500">
            <div className="border-b border-slate-200 pb-6">
              <h2 className="text-3xl font-bold text-slate-900 mb-2">{activeFolder?.name}</h2>
              <p className="text-slate-500">Last updated {new Date(activeFolder?.createdAt || 0).toLocaleDateString()}</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 min-h-[600px]">
              {/* Left Side: Video Section */}
              <div className="lg:col-span-7 flex flex-col gap-6">
                <div className="bg-brand-navy rounded-3xl overflow-hidden shadow-2xl relative aspect-video flex items-center justify-center">
                  {activeFolder?.videos && activeFolder.videos.length > 0 ? (
                    <video 
                      key={activeFolder.videos[activeVideoIdx]?.id}
                      controls 
                      className="w-full h-full object-contain"
                      src={activeFolder.videos[activeVideoIdx]?.url}
                    />
                  ) : (
                    <div className="text-slate-500 flex flex-col items-center">
                      <Play size={48} className="mb-4 opacity-20" />
                      <p>No video attached</p>
                    </div>
                  )}
                </div>
                
                {/* Video Selector if multiple */}
                {activeFolder?.videos && activeFolder.videos.length > 1 && (
                  <div className="flex gap-3 overflow-x-auto pb-2 custom-scrollbar">
                    {activeFolder.videos.map((vid, idx) => (
                      <button
                        key={vid.id}
                        onClick={() => setActiveVideoIdx(idx)}
                        className={`flex-shrink-0 w-32 aspect-video rounded-xl overflow-hidden border-2 transition-all ${activeVideoIdx === idx ? 'border-brand-red scale-105' : 'border-transparent opacity-60 hover:opacity-100'}`}
                      >
                        <video src={vid.url} className="w-full h-full object-cover pointer-events-none" />
                      </button>
                    ))}
                  </div>
                )}

                {/* Notes Section */}
                <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2 text-slate-700 font-semibold">
                      <MessageSquare size={18} />
                      <span>Notes</span>
                    </div>
                    <button
                      onClick={handleSaveNotes}
                      disabled={isSavingNotes || folderNotes === (activeFolder?.notes || '')}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg bg-brand-red text-white hover:bg-brand-red-dark disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                      <Save size={14} />
                      {isSavingNotes ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                  <textarea
                    value={folderNotes}
                    onChange={(e) => setFolderNotes(e.target.value)}
                    placeholder="Add notes for this folder..."
                    className="w-full h-32 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-red focus:bg-white transition-all resize-none text-slate-700"
                  />
                </div>

              </div>

              {/* Right Side: Image Vertical Carousel */}
              <div className="lg:col-span-5 flex flex-col">
                <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden flex flex-col h-full shadow-lg">
                  <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <span className="font-bold text-slate-700 text-lg">Supporting Assets</span>
                    <span className="text-xs bg-slate-200 px-2 py-1 rounded-full text-slate-600 font-medium">
                      {activeFolder?.images.length} images
                    </span>
                  </div>
                  <div className="flex-1 overflow-y-auto custom-scrollbar p-4 max-h-[700px]">
                    {activeFolder?.images.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-slate-400 py-20">
                        <ImageIcon size={32} className="mb-2 opacity-30" />
                        <p className="text-sm">No images added</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-3">
                        {activeFolder?.images.map((img, idx) => (
                          <div key={img.id} className="group relative aspect-square">
                            <img
                              src={img.url}
                              alt={img.name}
                              className="w-full h-full object-cover rounded-xl border border-slate-100 shadow-sm transition-transform duration-300 group-hover:scale-[1.02]"
                            />
                            <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-md text-white text-xs px-2 py-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity font-medium">
                              #{idx + 1}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Creation/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-brand-navy/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-5xl rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="flex items-center justify-between px-8 py-6 border-b border-slate-100">
              <h2 className="text-2xl font-bold text-slate-800">{editingFolderId ? 'Edit Folder' : 'Create New Folder'}</h2>
              <button onClick={resetModal} className="text-slate-400 hover:text-slate-600 p-2 hover:bg-slate-100 rounded-xl transition-all">
                <X size={24} />
              </button>
            </div>
            
            <div className="p-8 space-y-8 overflow-y-auto max-h-[70vh] custom-scrollbar">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2 uppercase tracking-wider">Folder Name</label>
                <input 
                  autoFocus
                  type="text" 
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="e.g. Q3 Marketing Showcase"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-red focus:bg-white transition-all text-lg font-medium"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Videos Section */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2 uppercase tracking-wider">Videos ({tempVideos.length})</label>
                  <FileInput
                    label="Add Videos"
                    icon={<Play size={32} />}
                    accept="video/*"
                    multiple
                    onChange={handleVideoUpload}
                  />
                  {isUploadingVideos && (
                    <div className="mt-4 flex items-center gap-3 bg-brand-red/10 p-4 rounded-xl border border-brand-red/20">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-brand-red"></div>
                      <span className="text-sm text-brand-red font-medium">Converting video... This may take a few minutes for large files.</span>
                    </div>
                  )}
                  {tempVideos.length > 0 && (
                    <div className="mt-4 space-y-2">
                      {tempVideos.map(vid => (
                        <div key={vid.id} className="flex items-center gap-3 bg-slate-50 p-2 rounded-xl border border-slate-100 group">
                          <video className="w-16 h-10 object-cover rounded-lg" src={vid.url} />
                          <span className="flex-1 text-sm text-slate-600 truncate">{vid.name}</span>
                          <button 
                            onClick={() => setTempVideos(prev => prev.filter(v => v.id !== vid.id))}
                            className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Images Section */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2 uppercase tracking-wider">Supporting Images ({tempImages.length})</label>
                  <FileInput
                    label="Add Supporting Images"
                    icon={<ImageIcon size={32} />}
                    accept="image/*"
                    multiple
                    onChange={handleImagesUpload}
                  />
                  {isUploadingImages && (
                    <div className="mt-4 flex items-center gap-3 bg-brand-red/10 p-4 rounded-xl border border-brand-red/20">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-brand-red"></div>
                      <span className="text-sm text-brand-red font-medium">Processing images...</span>
                    </div>
                  )}
                  {tempImages.length > 0 && (
                    <div className="mt-4 grid grid-cols-4 gap-2">
                      {tempImages.map(img => (
                        <div key={img.id} className="relative aspect-square group">
                          <img src={img.url} className="w-full h-full object-cover rounded-lg border border-slate-200" />
                          <button 
                            onClick={() => setTempImages(prev => prev.filter(i => i.id !== img.id))}
                            className="absolute -top-1 -right-1 bg-red-500 text-white p-0.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="px-8 py-6 bg-slate-50 flex items-center justify-end gap-3">
              <button onClick={resetModal} className="px-6 py-2.5 rounded-xl font-semibold text-slate-600 hover:bg-slate-200 transition-all">
                Cancel
              </button>
              <button
                onClick={handleSaveFolder}
                disabled={isSaving || !newFolderName || isUploadingVideos || isUploadingImages}
                className="bg-brand-red hover:bg-brand-red-dark disabled:opacity-50 disabled:cursor-not-allowed text-white px-8 py-2.5 rounded-xl font-semibold shadow-lg transition-all active:scale-95 flex items-center gap-2"
              >
                {isSaving ? 'Saving...' : isUploadingVideos || isUploadingImages ? 'Uploading...' : (editingFolderId ? 'Save Changes' : 'Create Folder')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Profile Settings Modal */}
      {isProfileSettingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-brand-navy/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
              <h2 className="text-xl font-bold text-slate-800">Profile Settings</h2>
              <button
                onClick={() => setIsProfileSettingsOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-2 hover:bg-slate-100 rounded-xl transition-all"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Display Name</label>
                <input
                  type="text"
                  value={profileDisplayName}
                  onChange={(e) => setProfileDisplayName(e.target.value)}
                  placeholder="Your display name"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-red focus:bg-white transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Email</label>
                <input
                  type="email"
                  value={user?.email || ''}
                  disabled
                  className="w-full bg-slate-100 border border-slate-200 rounded-xl px-4 py-3 text-slate-500 cursor-not-allowed"
                />
                <p className="text-xs text-slate-400 mt-1">Email cannot be changed</p>
              </div>
            </div>

            <div className="px-6 py-4 bg-slate-50 flex items-center justify-end gap-3">
              <button
                onClick={() => setIsProfileSettingsOpen(false)}
                className="px-5 py-2.5 rounded-xl font-semibold text-slate-600 hover:bg-slate-200 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  setIsSavingProfile(true);
                  try {
                    // For now, just close the modal - full Supabase user update can be added later
                    // await supabase.auth.updateUser({ data: { full_name: profileDisplayName } });
                    setIsProfileSettingsOpen(false);
                  } finally {
                    setIsSavingProfile(false);
                  }
                }}
                disabled={isSavingProfile}
                className="bg-brand-red hover:bg-brand-red-dark disabled:opacity-50 text-white px-6 py-2.5 rounded-xl font-semibold shadow-lg transition-all active:scale-95"
              >
                {isSavingProfile ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
