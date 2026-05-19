/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  ClipboardList, 
  BarChart3, 
  LogOut, 
  Plus, 
  User, 
  School, 
  Calendar, 
  Package, 
  CheckCircle2, 
  Clock, 
  XCircle,
  TrendingUp,
  Users,
  HandHeart,
  Camera,
  ImagePlus,
  FileImage,
  Edit,
  Trash2,
  PieChart as PieChartIcon,
  ShieldCheck,
  ChevronRight,
  ArrowLeft,
  Printer,
  Download,
  FileText,
  Square,
  CheckSquare
} from 'lucide-react';
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  Tooltip, 
  Legend 
} from 'recharts';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { motion, AnimatePresence } from 'motion/react';
import { auth, signInWithGoogle, logout } from './lib/firebase';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { distributionService } from './services/distributionService';
import { Distribution, Serving } from './types';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const calculateStatus = (time: string) => {
  if (!time) return '';
  const [hours, minutes] = time.split(':').map(Number);
  const totalMinutes = hours * 60 + (minutes || 0);
  
  if (totalMinutes >= 6 * 60 && totalMinutes < 12 * 60) {
    return 'Tepat Waktu';
  } else if (totalMinutes >= 12 * 60 && totalMinutes <= 18 * 60) {
    return 'Terlambat';
  }
  return '';
};

type Tab = 'input' | 'pembagian' | 'laporan';

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('input');
  const [distributions, setDistributions] = useState<Distribution[]>([]);
  const [servings, setServings] = useState<Serving[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [editingDistribution, setEditingDistribution] = useState<Distribution | null>(null);
  const [editingServing, setEditingServing] = useState<Serving | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{
    id: string;
    type: 'distribution' | 'serving' | 'bulk-distribution' | 'bulk-serving';
    title: string;
    message: string;
    ids?: string[];
    hasRelated?: boolean;
    onDeleteServings?: boolean;
  } | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user, refreshKey]);

  const loadData = async () => {
    const [distData, servData] = await Promise.all([
      distributionService.getAllDistributions(),
      distributionService.getAllServings()
    ]);
    setDistributions(distData || []);
    setServings(servData || []);
  };

  const handleDeleteDistribution = (id: string) => {
    const dist = distributions.find(d => d.id === id);
    if (!dist) return;

    const relatedCount = servings.filter(s => s.date === dist.date).length;
    
    setDeleteConfirm({
      id,
      type: 'distribution',
      title: 'Hapus Distribusi',
      message: `Anda akan menghapus data distribusi tanggal ${dist.date} (${dist.menuDetails}).`,
      hasRelated: relatedCount > 0,
      onDeleteServings: relatedCount > 0
    });
  };

  const handleDeleteServing = (id: string) => {
    const serving = servings.find(s => s.id === id);
    if (!serving) return;

    setDeleteConfirm({
      id,
      type: 'serving',
      title: 'Hapus Riwayat Pembagian',
      message: `Hapus data pembagian untuk ${serving.recipientName}?`
    });
  };

  const handleBulkDeleteDistributions = (ids: string[]) => {
    const selectedItems = distributions.filter(item => ids.includes(item.id!));
    const affectedDates = Array.from(new Set(selectedItems.map(item => item.date)));
    const relatedCount = servings.filter(s => affectedDates.includes(s.date)).length;

    setDeleteConfirm({
      id: 'bulk',
      ids,
      type: 'bulk-distribution',
      title: `Hapus ${ids.length} Distribusi`,
      message: `Anda akan menghapus ${ids.length} data distribusi terpilih.`,
      hasRelated: relatedCount > 0,
      onDeleteServings: relatedCount > 0
    });
  };

  const handleBulkDeleteServings = (ids: string[]) => {
    setDeleteConfirm({
      id: 'bulk',
      ids,
      type: 'bulk-serving',
      title: `Hapus ${ids.length} Riwayat`,
      message: `Hapus ${ids.length} data riwayat pembagian terpilih?`
    });
  };

  const executeDelete = async () => {
    if (!deleteConfirm) return;

    try {
      if (deleteConfirm.type === 'distribution') {
        const dist = distributions.find(d => d.id === deleteConfirm.id);
        const related = servings.filter(s => s.date === dist?.date);
        
        await distributionService.deleteDistribution(deleteConfirm.id);
        if (deleteConfirm.onDeleteServings && related.length > 0) {
          await Promise.all(related.map(s => distributionService.deleteServing(s.id!)));
        }
      } else if (deleteConfirm.type === 'serving') {
        await distributionService.deleteServing(deleteConfirm.id);
      } else if (deleteConfirm.type === 'bulk-distribution' && deleteConfirm.ids) {
        const selectedItems = distributions.filter(item => deleteConfirm.ids!.includes(item.id!));
        const affectedDates = Array.from(new Set(selectedItems.map(item => item.date)));
        
        await Promise.all(deleteConfirm.ids.map(id => distributionService.deleteDistribution(id)));
        
        if (deleteConfirm.onDeleteServings) {
          const related = servings.filter(s => affectedDates.includes(s.date));
          await Promise.all(related.map(s => distributionService.deleteServing(s.id!)));
        }
      } else if (deleteConfirm.type === 'bulk-serving' && deleteConfirm.ids) {
        await Promise.all(deleteConfirm.ids.map(id => distributionService.deleteServing(id)));
      }

      setDeleteConfirm(null);
      setRefreshKey(prev => prev + 1);
    } catch (error) {
      console.error('Delete execution error:', error);
      alert('Terjadi kesalahan saat menghapus data.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-500 font-medium text-sm">Memasuki Database SCB...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LandingPage onLogin={signInWithGoogle} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row">
      {/* Sidebar Desktop */}
      <aside className="hidden md:flex w-64 flex-col bg-emerald-900 text-white shadow-xl h-screen sticky top-0 overflow-y-auto">
        <div className="p-6 flex items-center gap-3">
          <div className="w-10 h-10 bg-yellow-500 rounded-lg flex items-center justify-center font-bold text-emerald-900 text-xl shadow-lg shadow-black/20">
            SCB
          </div>
          <div>
            <h1 className="text-sm font-bold leading-tight">MBG Tracker</h1>
            <p className="text-[10px] opacity-70 italic font-medium">Baitu Maal Baznas</p>
          </div>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-2">
          <SidebarItem 
            active={activeTab === 'input'} 
            onClick={() => setActiveTab('input')}
            icon={<ClipboardList size={20} />}
            label="Input Distribusi"
          />
          <SidebarItem 
            active={activeTab === 'pembagian'} 
            onClick={() => setActiveTab('pembagian')}
            icon={<HandHeart size={20} />}
            label="Proses Pembagian"
          />
          <SidebarItem 
            active={activeTab === 'laporan'} 
            onClick={() => setActiveTab('laporan')}
            icon={<BarChart3 size={20} />}
            label="Laporan Ringkasan"
          />
        </nav>

        <div className="p-6 mt-auto border-t border-white/10">
          <div className="flex items-center gap-3 text-[10px] text-white/50 mb-4 truncate">
            <div className="w-2 h-2 rounded-full bg-emerald-400"></div>
            {user.email}
          </div>
          <button 
            onClick={logout}
            className="w-full flex items-center gap-3 px-3 py-2 text-white/70 hover:text-white hover:bg-white/5 rounded-lg transition-all text-sm font-medium"
          >
            <LogOut size={18} />
            Keluar Sistem
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Header Mobile & Common Header */}
        <header className="bg-white border-b border-slate-200 px-8 py-6 flex items-center justify-between">
          <div className="md:hidden flex items-center gap-2">
            <div className="w-8 h-8 bg-yellow-500 rounded flex items-center justify-center font-bold text-emerald-900 text-sm">SCB</div>
            <span className="font-bold text-emerald-900">MBG Tracker</span>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-900">
              {activeTab === 'input' ? 'Dashboard Distribusi' : activeTab === 'pembagian' ? 'Monitoring Pembagian' : 'Analisis Distribusi'}
            </h2>
            <p className="hidden md:block text-slate-500 text-sm">
              {activeTab === 'input' ? 'Monitoring Makanan Bergizi Gratis Real-time' : activeTab === 'pembagian' ? 'Pencatatan serving harian ke penerima manfaat' : 'Ringkasan distribusi per menu dan tendik'}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex flex-col items-end">
              <span className="text-sm font-bold text-slate-900">{user.displayName}</span>
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Petugas Aktif</span>
            </div>
            <img 
              src={user.photoURL || ''} 
              alt="Avatar" 
              className="w-10 h-10 rounded-lg border border-slate-100 shadow-sm"
            />
          </div>
        </header>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-slate-50">
          <AnimatePresence>
            {deleteConfirm && (
              <DeleteConfirmModal 
                config={deleteConfirm}
                onClose={() => setDeleteConfirm(null)}
                onConfirm={executeDelete}
                onToggleRelated={(val) => setDeleteConfirm(prev => prev ? { ...prev, onDeleteServings: val } : null)}
              />
            )}
          </AnimatePresence>
          <AnimatePresence mode="wait">
            {activeTab === 'input' && (
              <motion.div
                key="input"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="max-w-6xl mx-auto"
              >
                <div className="grid grid-cols-12 gap-8">
                  <div className="col-span-12 lg:col-span-5">
                    <DistributionForm onSuccess={() => setRefreshKey(prev => prev + 1)} />
                  </div>
                  <div className="col-span-12 lg:col-span-7">
                    <RecentActivity 
                      data={distributions} 
                      onEdit={(item) => setEditingDistribution(item)}
                      onDelete={handleDeleteDistribution}
                      onBulkDelete={handleBulkDeleteDistributions}
                      servings={servings}
                      onRefresh={() => setRefreshKey(prev => prev + 1)}
                    />
                  </div>
                </div>

                {/* Edit Modal */}
                <AnimatePresence>
                  {editingDistribution && (
                    <EditDistributionModal 
                      distribution={editingDistribution}
                      onClose={() => setEditingDistribution(null)}
                      onSuccess={() => {
                        setEditingDistribution(null);
                        setRefreshKey(prev => prev + 1);
                      }}
                      onDelete={handleDeleteDistribution}
                    />
                  )}
                </AnimatePresence>
              </motion.div>
            )}

            {activeTab === 'pembagian' && (
              <motion.div
                key="pembagian"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="max-w-6xl mx-auto"
              >
                <div className="grid grid-cols-12 gap-8">
                  <div className="col-span-12 lg:col-span-5 space-y-6">
                    <PembagianForm 
                      onSuccess={() => setRefreshKey(prev => prev + 1)} 
                      distributions={distributions}
                      servings={servings}
                    />
                    <QuickReturnCard 
                      servings={servings}
                      onUpdate={() => setRefreshKey(prev => prev + 1)}
                    />
                  </div>
                  <div className="col-span-12 lg:col-span-7">
                    <RecentServingActivity 
                      data={servings} 
                      onEdit={(item) => setEditingServing(item)}
                      onDelete={handleDeleteServing}
                      onBulkDelete={handleBulkDeleteServings}
                      distributions={distributions}
                      onRefresh={() => setRefreshKey(prev => prev + 1)}
                    />
                  </div>
                </div>

                {/* Edit Modal Serving */}
                <AnimatePresence>
                  {editingServing && (
                    <EditServingModal 
                      serving={editingServing}
                      onClose={() => setEditingServing(null)}
                      distributions={distributions}
                      servings={servings}
                      onSuccess={() => {
                        setEditingServing(null);
                        setRefreshKey(prev => prev + 1);
                      }}
                      onDelete={handleDeleteServing}
                    />
                  )}
                </AnimatePresence>
              </motion.div>
            )}

            {activeTab === 'laporan' && (
              <motion.div
                key="laporan"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="max-w-6xl mx-auto"
              >
                <ReportSection distributions={distributions} servings={servings} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Mobile Nav */}
        <nav className="md:hidden bg-emerald-900 border-t border-white/10 flex justify-around p-3 text-white">
          <MobileNavItem 
            active={activeTab === 'input'} 
            onClick={() => setActiveTab('input')}
            icon={<ClipboardList size={20} />}
            label="Input"
          />
          <MobileNavItem 
            active={activeTab === 'pembagian'} 
            onClick={() => setActiveTab('pembagian')}
            icon={<HandHeart size={20} />}
            label="Pembagian"
          />
          <MobileNavItem 
            active={activeTab === 'laporan'} 
            onClick={() => setActiveTab('laporan')}
            icon={<BarChart3 size={20} />}
            label="Laporan"
          />
        </nav>
      </main>
    </div>
  );
}

// ... existing components (LandingPage, DistributionForm, RecentActivity) ...

function PembagianForm({ 
  onSuccess, 
  distributions, 
  servings 
}: { 
  onSuccess: () => void, 
  distributions: Distribution[], 
  servings: Serving[] 
}) {
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  const [hasAutoSkipped, setHasAutoSkipped] = useState(false);
  const [formData, setFormData] = useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    time: format(new Date(), 'HH:mm'),
    recipientName: '',
    amount: 1,
    returnedAmount: 0,
    qualityControl: 'Baik' as 'Baik' | 'Kurang' | 'Tidak Layak',
  });

  // Auto-skip logic: If there's already a serving for this date, skip step 1
  useEffect(() => {
    const existingServing = servings.find(s => s.date === formData.date);
    if (existingServing && !hasAutoSkipped && step === 1) {
      setFormData(prev => ({ ...prev, qualityControl: existingServing.qualityControl }));
      setStep(2);
      setHasAutoSkipped(true);
    }
  }, [formData.date, servings, hasAutoSkipped, step]);

  // Reset auto-skip tracker when date changes
  useEffect(() => {
    setHasAutoSkipped(false);
  }, [formData.date]);

  // Calculate total received for this date
  const totalReceivedForDate = distributions
    .filter(d => d.date === formData.date)
    .reduce((sum, d) => sum + d.amount, 0);

  // Calculate total served for this date (excluding current form if it was an edit, but here it's only create)
  const totalServedForDate = servings
    .filter(s => s.date === formData.date)
    .reduce((sum, s) => sum + s.amount, 0);

  const availableStock = totalReceivedForDate - totalServedForDate;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formData.amount > availableStock) {
      alert(`Jumlah yang diberikan (${formData.amount}) melebihi stok yang tersedia (${availableStock}) untuk tanggal ini.`);
      return;
    }

    setLoading(true);
    try {
      await distributionService.createServing({
        ...formData,
        amount: Number(formData.amount),
      });
      setFormData({
        date: format(new Date(), 'yyyy-MM-dd'),
        time: format(new Date(), 'HH:mm'),
        recipientName: '',
        amount: 1,
        returnedAmount: 0,
        qualityControl: 'Baik',
      });
      setStep(1);
      setHasAutoSkipped(false);
      onSuccess();
    } catch (error) {
      alert('Gagal menyimpan data pembagian');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-card p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-bold flex items-center gap-3">
          <div className="w-1 h-6 bg-blue-600 rounded-full"></div>
          {step === 1 ? 'Step 1: Check Kualitas' : 'Step 2: Detail Pembagian'}
        </h3>
        
        {step === 2 && (
          <button 
            type="button"
            onClick={() => setStep(1)}
            className="flex items-center gap-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest hover:text-blue-600 transition-colors"
          >
            <ArrowLeft size={12} />
            Ubah QC
          </button>
        )}
      </div>

      <AnimatePresence mode="wait">
        {step === 1 ? (
          <motion.div 
            key="step1"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            className="space-y-6"
          >
            <div className="p-5 bg-slate-50 border border-slate-100 rounded-2xl">
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-4 text-center">
                Bagaimana Kondisi Makanan Saat Ini?
              </label>
              <div className="grid grid-cols-1 gap-3">
                {['Baik', 'Kurang', 'Tidak Layak'].map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setFormData({ ...formData, qualityControl: option as any })}
                    className={cn(
                      "group relative py-4 px-5 rounded-xl text-sm font-bold border transition-all flex items-center justify-between",
                      formData.qualityControl === option
                        ? option === 'Baik' ? "bg-emerald-50 text-emerald-700 border-emerald-200 shadow-sm" :
                          option === 'Kurang' ? "bg-amber-50 text-amber-700 border-amber-200 shadow-sm" :
                          "bg-red-50 text-red-700 border-red-200 shadow-sm"
                        : "bg-white text-slate-400 border-slate-100 hover:border-slate-200"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-3 h-3 rounded-full shadow-inner",
                        option === 'Baik' ? "bg-emerald-500" : option === 'Kurang' ? "bg-amber-500" : "bg-red-500"
                      )}></div>
                      <span className="tracking-tight">{option}</span>
                    </div>
                    {formData.qualityControl === option && (
                      <CheckCircle2 size={16} className={cn(
                        option === 'Baik' ? "text-emerald-600" : option === 'Kurang' ? "text-amber-600" : "text-red-600"
                      )} />
                    )}
                  </button>
                ))}
              </div>
            </div>

            <button 
              type="button"
              onClick={() => setStep(2)}
              className="w-full bg-blue-600 text-white font-bold py-4 rounded-xl shadow-xl shadow-blue-600/20 hover:bg-blue-700 transition-all active:scale-95 flex items-center justify-center gap-2 group"
            >
              Lanjut Isi Data
              <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />
            </button>
          </motion.div>
        ) : (
          <motion.div
            key="step2"
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
          >
            <form onSubmit={handleSubmit} className="space-y-5">
               <div className={cn(
                "p-3 rounded-lg flex items-center justify-between border mb-2",
                formData.qualityControl === 'Baik' ? "bg-emerald-50 border-emerald-100" :
                formData.qualityControl === 'Kurang' ? "bg-amber-50 border-amber-100" :
                "bg-red-50 border-red-100"
              )}>
                <div className="flex items-center gap-2">
                  <ShieldCheck size={14} className={cn(
                    formData.qualityControl === 'Baik' ? "text-emerald-600" :
                    formData.qualityControl === 'Kurang' ? "text-amber-600" :
                    "text-red-600"
                  )} />
                  <span className={cn(
                    "text-[10px] font-bold uppercase tracking-wider",
                     formData.qualityControl === 'Baik' ? "text-emerald-700" :
                     formData.qualityControl === 'Kurang' ? "text-amber-700" :
                     "text-red-700"
                  )}>
                    QC Terverifikasi: {formData.qualityControl}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">
                    Tanggal
                  </label>
                  <input 
                    type="date" 
                    required
                    value={formData.date}
                    onChange={e => setFormData({ ...formData, date: e.target.value })}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">
                    Jam Pembagian
                  </label>
                  <input 
                    type="time" 
                    required
                    value={formData.time}
                    onChange={e => setFormData({ ...formData, time: e.target.value })}
                    className="input-field"
                  />
                </div>
              </div>

              <div>
                {totalReceivedForDate > 0 ? (
                  <p className="text-[10px] text-slate-500 mt-1 ml-1 italic">
                    Total masuk: <span className="font-bold text-emerald-600">{totalReceivedForDate}</span> | Terbagi: <span className="font-bold text-blue-600">{totalServedForDate}</span>
                  </p>
                ) : (
                  <p className="text-[10px] text-red-500 mt-1 ml-1 italic font-medium">
                    Peringatan: Belum ada data distribusi masuk pada tanggal ini.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">
                  Nama Penerima
                </label>
                <input 
                  type="text" 
                  required
                  placeholder="Ketik nama penerima manfaat..."
                  value={formData.recipientName}
                  onChange={e => setFormData({ ...formData, recipientName: e.target.value })}
                  className="input-field"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">
                  Jumlah Diberikan
                </label>
                <input 
                  type="number" 
                  min="1"
                  max={availableStock > 0 ? availableStock : 1}
                  required
                  value={formData.amount}
                  onChange={e => setFormData({ ...formData, amount: parseInt(e.target.value) || 0 })}
                  className={cn(
                    "input-field font-bold",
                    formData.amount > availableStock ? "text-red-600 border-red-200 bg-red-50" : "text-blue-700"
                  )}
                />
              </div>
              
              {availableStock > 0 && (
                <p className="text-[10px] text-slate-400 mt-0 ml-1">
                  Maksimal pemberian: <span className="font-bold">{availableStock}</span> unit
                </p>
              )}

              <button 
                type="submit" 
                disabled={loading || availableStock <= 0 || formData.amount > availableStock}
                className="w-full bg-blue-600 text-white font-bold py-4 rounded-xl mt-4 shadow-xl shadow-blue-600/20 hover:bg-blue-700 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Menyimpan...
                  </>
                ) : (
                  <>
                    <HandHeart size={18} />
                    Simpan Pembagian
                  </>
                )}
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function QuickReturnCard({ servings, onUpdate }: { servings: Serving[], onUpdate: () => void }) {
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedServingId, setSelectedServingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [amount, setAmount] = useState<number>(0);

  // Find servings for selected date
  const servingsForDate = servings.filter(s => s.date === selectedDate);
  
  // Update selected serving when date or servings change
  useEffect(() => {
    if (servingsForDate.length > 0) {
      if (!selectedServingId || !servingsForDate.find(s => s.id === selectedServingId)) {
        setSelectedServingId(servingsForDate[0].id || null);
      }
    } else {
      setSelectedServingId(null);
    }
  }, [selectedDate, servings, selectedServingId]);

  const servingToUpdate = servingsForDate.find(s => s.id === selectedServingId) || servingsForDate[0];
  const totalGivenForDate = servingToUpdate?.amount || 0;
  
  useEffect(() => {
    if (servingToUpdate) {
      setAmount(servingToUpdate.returnedAmount || 0);
    } else {
      setAmount(0);
    }
  }, [servingToUpdate]);

  const handleUpdate = async () => {
    if (!servingToUpdate) return;
    if (amount > totalGivenForDate) {
       alert(`Jumlah kembali (${amount}) tidak boleh melebihi jumlah yang diberikan (${totalGivenForDate}).`);
       return;
    }
    setLoading(true);
    try {
      await distributionService.updateServing(servingToUpdate.id!, { 
        returnedAmount: amount 
      });
      onUpdate();
    } catch (e) {
      alert("Gagal update");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-card p-6 border-amber-200 bg-amber-50/30">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold flex items-center gap-3">
          <div className="w-1 h-5 bg-amber-500 rounded-full"></div>
          Update Jumlah Kembali
        </h3>
        {servingsForDate.length > 1 && (
          <span className="text-[10px] bg-amber-100 text-amber-700 font-bold px-2 py-0.5 rounded-full">
            {servingsForDate.length} Record
          </span>
        )}
      </div>
      
      <div className="space-y-4">
         <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Pilih Tanggal</label>
            <input 
              type="date" 
              value={selectedDate} 
              onChange={e => setSelectedDate(e.target.value)}
              className="input-field bg-white/50 py-2 text-xs"
            />
         </div>

         {servingToUpdate ? (
            <div className="p-4 bg-white rounded-xl border border-amber-100 shadow-sm space-y-4">
               <div className="flex justify-between items-center py-1 border-b border-dashed border-slate-100 gap-4">
                  <div className="flex flex-col flex-1 min-w-0">
                    <span className="text-[10px] font-bold text-slate-400 uppercase mb-1">Pilih Penerima</span>
                    {servingsForDate.length > 1 ? (
                      <select 
                        value={selectedServingId || ''} 
                        onChange={e => setSelectedServingId(e.target.value)}
                        className="bg-transparent text-xs font-bold text-slate-700 border-none p-0 focus:ring-0 cursor-pointer truncate"
                      >
                        {servingsForDate.map(s => (
                          <option key={s.id} value={s.id}>{s.recipientName} ({s.amount})</option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-xs font-bold text-slate-700 truncate">{servingToUpdate.recipientName}</span>
                    )}
                  </div>
                  <div className="flex flex-col items-end shrink-0">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Diberikan</span>
                    <span className="text-xs font-bold text-blue-600 tabular-nums">{totalGivenForDate} unit</span>
                  </div>
               </div>

               <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Update Jumlah Kembali</label>
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <input 
                        type="number"
                        min="0"
                        max={totalGivenForDate}
                        value={amount}
                        onChange={e => {
                          const val = parseInt(e.target.value) || 0;
                          setAmount(val > totalGivenForDate ? totalGivenForDate : val);
                        }}
                        className="w-full bg-slate-50 border-none rounded-lg py-2 px-3 text-sm font-bold text-amber-600 focus:ring-2 focus:ring-amber-200 transition-all text-center"
                      />
                    </div>
                    <button 
                      onClick={handleUpdate}
                      disabled={loading}
                      className="bg-amber-500 hover:bg-amber-600 text-white px-5 py-2 rounded-lg text-xs font-bold transition-all disabled:opacity-50 shadow-md shadow-amber-500/20 active:scale-95"
                    >
                      {loading ? (
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : 'Simpan'}
                    </button>
                  </div>
                  <p className="text-[9px] text-slate-400 mt-2 italic text-center">
                    Data tersinkron otomatis dengan riwayat pembagian.
                  </p>
               </div>
            </div>
         ) : (
            <div className="p-6 text-center text-slate-400 bg-white/40 border border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center min-h-[120px]">
               <Package className="w-6 h-6 mb-2 opacity-20" />
               <p className="text-[10px] italic font-medium">Belum ada data pembagian<br/>pada tanggal ini.</p>
            </div>
         )}
      </div>
    </div>
  );
}

function DeleteConfirmModal({ 
  config, 
  onClose, 
  onConfirm,
  onToggleRelated
}: { 
  config: {
    title: string;
    message: string;
    ids?: string[];
    hasRelated?: boolean;
    onDeleteServings?: boolean;
    type: string;
  }, 
  onClose: () => void, 
  onConfirm: () => void,
  onToggleRelated: (val: boolean) => void
}) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
      />
      <motion.div 
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 20 }}
        className="relative bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden border border-slate-100"
      >
        <div className="p-6">
          <div className="w-12 h-12 bg-red-50 text-red-600 rounded-xl flex items-center justify-center mb-4">
            <Trash2 size={24} />
          </div>
          <h3 className="text-lg font-black text-slate-800 mb-2">{config.title}</h3>
          <p className="text-sm text-slate-500 leading-relaxed mb-6">{config.message}</p>
          
          {config.hasRelated && (
            <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 mb-6">
              <div className="flex items-start gap-3">
                <div className="mt-0.5">
                  <ShieldCheck size={16} className="text-amber-600" />
                </div>
                <div>
                  <p className="text-xs font-bold text-amber-800 mb-1">Sinkronisasi Data</p>
                  <p className="text-[11px] text-amber-700 leading-relaxed mb-3">
                    Hapus juga semua data riwayat pembagian yang terhubung dengan distribusi ini agar data tetap akurat?
                  </p>
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <div 
                      onClick={() => onToggleRelated(!config.onDeleteServings)}
                      className="shrink-0"
                    >
                      {config.onDeleteServings ? (
                        <CheckSquare size={18} className="text-amber-600" />
                      ) : (
                        <Square size={18} className="text-amber-300 group-hover:text-amber-400" />
                      )}
                    </div>
                    <span className="text-[11px] font-bold text-amber-800">Ya, hapus riwayat pembagian juga</span>
                  </label>
                </div>
              </div>
            </div>
          )}
          
          <div className="flex gap-3">
            <button 
              onClick={onClose}
              className="flex-1 py-3 border border-slate-200 rounded-xl font-bold text-slate-600 hover:bg-slate-50 transition-all text-sm"
            >
              Batal
            </button>
            <button 
              onClick={onConfirm}
              className="flex-[2] bg-red-600 text-white font-bold py-3 rounded-xl shadow-lg shadow-red-600/20 hover:bg-red-700 transition-all text-sm flex items-center justify-center gap-2"
            >
              <Trash2 size={16} />
              Konfirmasi Hapus
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function RecentServingActivity({ 
  data, 
  onEdit, 
  onDelete,
  onBulkDelete,
  distributions,
  onRefresh
}: { 
  data: Serving[], 
  onEdit: (item: Serving) => void,
  onDelete: (id: string) => void,
  onBulkDelete: (ids: string[]) => void,
  distributions: Distribution[],
  onRefresh: () => void
}) {
  const [filterDate, setFilterDate] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const filteredData = filterDate 
    ? data.filter(item => item.date === filterDate)
    : data;

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredData.length && filteredData.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredData.map(item => item.id!).filter(Boolean));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleBulkDelete = () => {
    if (selectedIds.length === 0) return;
    onBulkDelete(selectedIds);
    setSelectedIds([]);
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full">
      <div className="p-5 border-b border-slate-100 bg-slate-50 flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <h4 className="text-sm font-bold text-slate-700 uppercase tracking-tight">Riwayat Pembagian</h4>
          <div className="flex items-center gap-2">
            <Calendar size={14} className="text-slate-400" />
            <input 
              type="date"
              value={filterDate}
              onChange={e => {
                setFilterDate(e.target.value);
                setSelectedIds([]); // Reset selection when filter changes
              }}
              className="text-[10px] bg-white border border-slate-200 rounded-lg px-2 py-1 font-medium text-slate-600 focus:ring-1 focus:ring-blue-100 outline-none"
            />
            {filterDate && (
              <button 
                onClick={() => {
                  setFilterDate('');
                  setSelectedIds([]);
                }}
                className="text-[10px] text-blue-600 font-bold hover:underline"
              >
                Reset
              </button>
            )}
          </div>
        </div>

        {filteredData.length > 0 && (
          <div className="flex items-center justify-between pt-2 border-t border-slate-100 mt-1">
            <div className="flex items-center gap-3">
              <button 
                onClick={toggleSelectAll}
                className="flex items-center gap-2 text-[10px] font-bold text-slate-500 hover:text-blue-600 transition-colors"
              >
                {selectedIds.length === filteredData.length && filteredData.length > 0 ? (
                  <CheckSquare size={14} className="text-blue-600" />
                ) : (
                  <Square size={14} />
                )}
                {selectedIds.length === filteredData.length ? 'Batal Semua' : 'Pilih Semua'}
              </button>
              {selectedIds.length > 0 && (
                <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                  {selectedIds.length} Terpilih
                </span>
              )}
            </div>
            
            {selectedIds.length > 0 && (
              <button 
                onClick={handleBulkDelete}
                className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-all"
              >
                <Trash2 size={14} />
                Hapus Terpilih
              </button>
            )}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto max-h-[500px]">
        {filteredData.length === 0 ? (
          <div className="py-20 text-center text-slate-400">
            <HandHeart className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p className="font-medium italic">
              {filterDate ? `Tidak ada pembagian pada ${filterDate}` : 'Belum ada rekaman pembagian.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {filteredData.map((item, idx) => {
              const relatedDist = distributions.find(d => d.date === item.date);
              const isSelected = selectedIds.includes(item.id!);
              
              return (
                <motion.div 
                  key={item.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: idx * 0.05 }}
                  className={cn(
                    "p-5 transition-colors flex items-center gap-5 group",
                    isSelected ? "bg-blue-50/50" : "hover:bg-slate-50"
                  )}
                >
                  <div 
                    onClick={() => toggleSelect(item.id!)}
                    className="shrink-0 flex items-center p-2 -ml-2 hover:bg-white rounded-lg transition-colors cursor-pointer"
                  >
                    {isSelected ? (
                      <CheckSquare size={18} className="text-blue-600" />
                    ) : (
                      <Square size={18} className="text-slate-300 group-hover:text-blue-400" />
                    )}
                  </div>
                  <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center shrink-0">
                    <HandHeart size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center mb-0.5">
                      <p className="text-sm font-bold text-slate-900 truncate pr-2">{item.recipientName}</p>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-slate-400 shrink-0 tabular-nums">
                          {item.date} • {item.time}
                        </span>
                        <div className="flex items-center gap-1">
                          <button 
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onEdit(item);
                            }}
                            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-all flex items-center justify-center relative z-20"
                            title="Edit"
                          >
                            <Edit size={14} />
                          </button>
                          <button 
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (item.id) {
                                onDelete(item.id);
                              }
                            }}
                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-all flex items-center justify-center cursor-pointer relative z-20"
                            title="Hapus"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                    {relatedDist && (
                      <div className="mb-2">
                         <span className="text-[10px] font-medium text-slate-400 italic">Distribusi: {relatedDist.menuDetails}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-slate-500 flex items-center gap-2">
                        Terbagi <span className="font-bold text-blue-600">{item.amount}</span> 
                        {item.returnedAmount ? <span className="text-amber-600 font-medium">(Kembali: {item.returnedAmount})</span> : null}
                        {item.qualityControl && (
                          <span className={cn(
                            "ml-2 text-[9px] font-bold px-1.5 py-0.5 rounded uppercase border",
                            item.qualityControl === 'Baik' ? "bg-emerald-50 text-emerald-700 border-emerald-100" :
                            item.qualityControl === 'Kurang' ? "bg-amber-50 text-amber-600 border-amber-100" :
                            "bg-red-50 text-red-600 border-red-100"
                          )}>
                            QC: {item.qualityControl}
                          </span>
                        )}
                      </p>
                      <span className="text-[10px] font-bold text-emerald-600">
                        Net: {item.amount - (item.returnedAmount || 0)} MBG
                      </span>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function ReportSection({ distributions, servings }: { distributions: Distribution[], servings: Serving[] }) {
  const reportRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);

  const exportToPDF = async () => {
    if (!reportRef.current) return;
    
    setIsExporting(true);
    try {
      // 1. Inject compatibility styles to ACTUAL document before capture
      const compatStyle = document.createElement('style');
      compatStyle.id = 'pdf-compat-style';
      compatStyle.innerHTML = `
        :root {
          /* Force standard HEX for all possible Tailwind v4 variables used in the app */
          --color-slate-50: #f8fafc !important;
          --color-slate-100: #f1f5f9 !important;
          --color-slate-200: #e2e8f0 !important;
          --color-slate-300: #cbd5e1 !important;
          --color-slate-400: #94a3b8 !important;
          --color-slate-500: #64748b !important;
          --color-slate-600: #475569 !important;
          --color-slate-700: #334155 !important;
          --color-slate-800: #1e293b !important;
          --color-slate-900: #0f172a !important;
          --color-blue-50: #eff6ff !important;
          --color-blue-100: #dbeafe !important;
          --color-blue-600: #2563eb !important;
          --color-emerald-50: #ecfdf5 !important;
          --color-emerald-500: #10b981 !important;
          --color-emerald-600: #059669 !important;
          --color-amber-50: #fffbeb !important;
          --color-amber-500: #f59e0b !important;
          --color-red-500: #ef4444 !important;
          
          /* Also override some internal CSS variables that might use oklch */
          --tw-border-opacity: 1 !important;
          --tw-text-opacity: 1 !important;
          --tw-bg-opacity: 1 !important;
          --tw-gradient-from: #ffffff !important;
          --tw-gradient-to: #ffffff !important;
          --tw-ring-color: #e2e8f0 !important;
        }
        
        /* Force inherit plain colors to avoid oklch leaks */
        * {
          border-color: #e2e8f0 !important;
          outline-color: #e2e8f0 !important;
        }
      `;
      document.head.appendChild(compatStyle);

      await new Promise(resolve => setTimeout(resolve, 800));

      const canvas = await html2canvas(reportRef.current, {
        scale: 2,
        useCORS: true,
        logging: true, // Enable logging to see where it fails if it does
        backgroundColor: '#ffffff',
        onclone: (clonedDoc) => {
          const reportRoot = clonedDoc.getElementById('pdf-report-root');
          if (reportRoot) {
            reportRoot.style.width = '1100px';
            reportRoot.style.padding = '40px';
            reportRoot.style.backgroundColor = '#ffffff';
          }

          // 2. Aggressive DOM Sanitization
          const allEl = clonedDoc.querySelectorAll('*');
          const clonedView = clonedDoc.defaultView || window;
          
          allEl.forEach((node: any) => {
            const el = node as HTMLElement;
            const style = clonedView.getComputedStyle(el);
            
            // Check for oklch or oklab in crucial properties
            const colorProps = ['color', 'backgroundColor', 'borderColor', 'fill', 'stroke', 'stopColor'];
            colorProps.forEach(prop => {
              const val = (el.style as any)[prop] || style.getPropertyValue(prop);
              if (val && (val.indexOf('oklch') !== -1 || val.indexOf('oklab') !== -1)) {
                // Force safe fallbacks based on common classes or general dark/light context
                if (prop === 'backgroundColor') {
                  if (el.classList.contains('bg-slate-50')) (el.style as any)[prop] = '#f8fafc';
                  else if (el.classList.contains('bg-blue-600')) (el.style as any)[prop] = '#2563eb';
                  else if (el.classList.contains('bg-emerald-600')) (el.style as any)[prop] = '#059669';
                  else (el.style as any)[prop] = '#ffffff';
                } else if (prop === 'color') {
                  if (el.classList.contains('text-slate-900')) (el.style as any)[prop] = '#0f172a';
                  else if (el.classList.contains('text-blue-600')) (el.style as any)[prop] = '#2563eb';
                  else if (el.classList.contains('text-emerald-600')) (el.style as any)[prop] = '#059669';
                  else (el.style as any)[prop] = '#334155';
                } else {
                  (el.style as any)[prop] = '#e2e8f0'; // Safe border fallback
                }
              }
            });

            // Ensure charts SVGs don't use oklch
            if (el.tagName === 'path' || el.tagName === 'circle' || el.tagName === 'rect') {
              const fill = el.getAttribute('fill');
              const stroke = el.getAttribute('stroke');
              if (fill && fill.includes('okl')) el.setAttribute('fill', '#94a3b8');
              if (stroke && stroke.includes('okl')) el.setAttribute('stroke', '#cbd5e1');
            }

            // Ensure visibility for tables
            if (el.tagName === 'TABLE' || el.classList.contains('divide-y')) {
              el.style.visibility = 'visible';
              el.style.opacity = '1';
              el.style.backgroundColor = '#ffffff';
            }

            el.style.animation = 'none';
            el.style.transition = 'none';
          });

          // Fixed dimensions for charts
          const chartContainers = clonedDoc.querySelectorAll('.recharts-responsive-container');
          chartContainers.forEach((container: any) => {
            if (container.closest('.pdf-hide-diagram')) {
              container.style.display = 'none';
              return;
            }
            container.style.width = '550px';
            container.style.height = '350px';
            container.style.display = 'block';
            
            const svg = container.querySelector('svg');
            if (svg) {
              svg.setAttribute('width', '550');
              svg.setAttribute('height', '350');
              svg.style.width = '550px';
              svg.style.height = '350px';
              
              // Recalculate viewbox if necessary or force standard
              if (!svg.getAttribute('viewBox')) {
                svg.setAttribute('viewBox', '0 0 550 350');
              }
            }
          });

          // Global style sterilization - FIXED REGEX to properly match oklch and oklab
          const styles = clonedDoc.querySelectorAll('style');
          styles.forEach(s => {
            s.innerHTML = s.innerHTML.replace(/okl(ch|ab)\([^)]+\)/g, '#475569');
          });
        }
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Laporan_MBG_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
      
      document.getElementById('pdf-compat-style')?.remove();
    } catch (error) {
      console.error('Error generating PDF:', error);
      document.getElementById('pdf-compat-style')?.remove();
      alert('Gagal membuat PDF. Masalah format warna terdeteksi. Silakan coba lagi.');
    } finally {
      setIsExporting(false);
    }
  };

  const statsByMenu = distributions.reduce((acc, curr) => {
    acc[curr.menuDetails] = (acc[curr.menuDetails] || 0) + curr.amount;
    return acc;
  }, {} as Record<string, number>);

  const statsByStatus = distributions.reduce((acc, curr) => {
    if (curr.status) {
      acc[curr.status] = (acc[curr.status] || 0) + curr.amount;
    }
    return acc;
  }, {} as Record<string, number>);

  const statsByQC = servings.reduce((acc, curr) => {
    if (curr.qualityControl) {
      acc[curr.qualityControl] = (acc[curr.qualityControl] || 0) + curr.amount;
    }
    return acc;
  }, {} as Record<string, number>);

  const statusData = Object.entries(statsByStatus).map(([name, value]) => ({ name, value }));
  const qcData = Object.entries(statsByQC).map(([name, value]) => ({ name, value }));

  const STATUS_COLORS = {
    'Tepat Waktu': '#10b981', // emerald-500
    'Terlambat': '#ef4444',   // red-500
  };

  const QC_COLORS = {
    'Baik': '#10b981',        // emerald-500
    'Kurang': '#f59e0b',      // amber-500
    'Tidak Layak': '#ef4444'  // red-500
  };

  const totalDistributed = distributions.reduce((sum, item) => sum + item.amount, 0);
  const totalServed = servings.reduce((sum, item) => sum + item.amount, 0);
  const stockRemaining = totalDistributed - totalServed;

  return (
    <div className="space-y-10 pb-20">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <FileText className="text-blue-600" size={24} />
            Summary Report & Analytics
          </h3>
          <p className="text-xs text-slate-400 font-medium italic mt-1">
            Data rekapitulasi distribusi dan pembagian per {format(new Date(), 'dd MMMM yyyy')}
          </p>
        </div>
        <button 
          onClick={exportToPDF}
          disabled={isExporting}
          className="flex items-center gap-2 bg-slate-900 text-white px-5 py-2.5 rounded-xl font-bold text-xs hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/10 active:scale-95 disabled:opacity-50"
        >
          {isExporting ? (
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <Download size={16} />
          )}
          {isExporting ? 'Generating PDF...' : 'Download PDF Report'}
        </button>
      </div>

      <div ref={reportRef} id="pdf-report-root" className="space-y-10 p-1 sm:p-0">
        {/* Print Header (Only visible in PDF/Print) */}
        <div className="hidden print:block mb-8 border-b-2 border-slate-900 pb-4">
          <h1 className="text-2xl font-bold uppercase tracking-tight text-slate-900">Laporan Monitoring MBG</h1>
          <p className="text-sm font-medium text-slate-500">Dicetak pada: {format(new Date(), 'dd/MM/yyyy HH:mm')}</p>
        </div>

        {/* Overview Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-2">Total Stok Masuk</p>
          <div className="flex items-end gap-2">
            <span className="text-3xl font-bold text-emerald-600">{totalDistributed}</span>
            <span className="text-xs text-slate-400 pb-1 font-bold italic">MBG</span>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-2">Total Terbagi</p>
          <div className="flex items-end gap-2">
            <span className="text-3xl font-bold text-blue-600">{totalServed}</span>
            <span className="text-xs text-slate-400 pb-1 font-bold italic">Porsi</span>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm border-l-4 border-l-amber-500">
          <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-2 font-mono">Sisa Inventori</p>
          <div className="flex items-end gap-2">
            <span className="text-3xl font-bold text-amber-600">{stockRemaining}</span>
            <span className="text-xs text-slate-400 pb-1 font-bold italic">Unit</span>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-2">Civitas Penerima</p>
          <div className="flex items-end gap-2">
            <span className="text-3xl font-bold text-emerald-900">{servings.length}</span>
            <span className="text-xs text-slate-400 pb-1 font-bold italic">Entitas</span>
          </div>
        </div>
      </div>

      {/* Summary Narrative (Redaksi Satu Baris) */}
      <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
        <p className="text-xs font-medium text-slate-700 leading-relaxed">
          <span className="font-bold">Analisis Ringkas:</span> Total stok distribusi masuk sebanyak <span className="font-bold text-emerald-600">{totalDistributed} MBG</span> telah berhasil diproses dan dibagikan kepada siswa sebanyak <span className="font-bold text-blue-600">{totalServed} porsi</span>, dengan sisa inventori tercatat sebanyak <span className="font-bold text-amber-600">{stockRemaining} unit</span> untuk periode pelaporan ini.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Status Chart */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Clock className="text-emerald-600" size={18} />
              <h4 className="text-sm font-bold text-slate-700 uppercase tracking-tight">Ketepatan Waktu Tiba</h4>
            </div>
          </div>
          
          <div className="flex flex-col gap-4">
            {/* Chart - Hidden in PDF Export via onclone/class */}
            <div className="h-[250px] w-full pdf-hide-diagram">
              {statusData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {statusData.map((entry: any, index) => (
                        <Cell key={`cell-${index}`} fill={STATUS_COLORS[entry.name as keyof typeof STATUS_COLORS] || '#cbd5e1'} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                    />
                    <Legend verticalAlign="bottom" height={36}/>
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-300">
                  <PieChartIcon size={40} className="mb-2 opacity-20" />
                  <p className="text-xs font-medium">Belum ada data status</p>
                </div>
              )}
            </div>

            {/* Text Description - Visible in PDF Export/UI */}
            <div className="space-y-3">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-50 pb-2">Keterangan Ketepatan Waktu</p>
              {statusData.length > 0 ? (
                <div className="grid grid-cols-1 gap-2">
                  {statusData.map((item) => {
                    const percentage = totalDistributed > 0 ? ((item.value / totalDistributed) * 100).toFixed(1) : 0;
                    return (
                      <div key={item.name} className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: STATUS_COLORS[item.name as keyof typeof STATUS_COLORS] }}></div>
                          <span className="text-xs font-bold text-slate-700">{item.name}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-xs font-mono font-bold text-slate-900">{item.value} MBG</span>
                          <span className="text-[10px] text-slate-400 ml-2">({percentage}%)</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-[10px] italic text-slate-400">Data tidak tersedia</p>
              )}
            </div>
          </div>
        </div>

        {/* QC Chart */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <ShieldCheck className="text-blue-600" size={18} />
              <h4 className="text-sm font-bold text-slate-700 uppercase tracking-tight">Rekap Quality Control</h4>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            {/* Chart - Hidden in PDF Export */}
            <div className="h-[250px] w-full pdf-hide-diagram">
              {qcData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={qcData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {qcData.map((entry: any, index) => (
                        <Cell key={`cell-${index}`} fill={QC_COLORS[entry.name as keyof typeof QC_COLORS] || '#cbd5e1'} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                    />
                    <Legend verticalAlign="bottom" height={36}/>
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-300">
                  <PieChartIcon size={40} className="mb-2 opacity-20" />
                  <p className="text-xs font-medium">Belum ada data QC</p>
                </div>
              )}
            </div>

            {/* Text Description */}
            <div className="space-y-3">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-50 pb-2">Keterangan Kualitas Makanan</p>
              {qcData.length > 0 ? (
                <div className="grid grid-cols-1 gap-2">
                  {qcData.map((item) => {
                    const percentage = totalServed > 0 ? ((item.value / totalServed) * 100).toFixed(1) : 0;
                    return (
                      <div key={item.name} className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: QC_COLORS[item.name as keyof typeof QC_COLORS] }}></div>
                          <span className="text-xs font-bold text-slate-700">{item.name}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-xs font-mono font-bold text-slate-900">{item.value} Porsi</span>
                          <span className="text-[10px] text-slate-400 ml-2">({percentage}%)</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-[10px] italic text-slate-400">Data tidak tersedia</p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-8">
        {/* Reports by Menu */}
        <div className="col-span-12 lg:col-span-6 bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="p-5 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
            <h4 className="text-sm font-bold text-slate-700 uppercase tracking-tight">Akumulasi Stok Per Menu</h4>
          </div>
          <table className="w-full text-sm text-left font-[Inter]">
            <thead>
              <tr className="text-slate-400 border-b border-slate-100">
                <th className="px-6 py-4 font-bold text-[10px] uppercase tracking-widest">Rincian Menu</th>
                <th className="px-6 py-4 font-bold text-[10px] uppercase tracking-widest text-right">Volume</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {Object.entries(statsByMenu).sort((a,b) => b[1] - a[1]).map(([menu, amount]) => (
                <tr key={menu} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 font-bold text-slate-700 max-w-[180px] truncate">{menu}</td>
                  <td className="px-6 py-4 text-right font-mono font-bold text-emerald-600">{amount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Reports by Recipient (Tendik) */}
        <div className="col-span-12 lg:col-span-6 bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="p-5 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
            <h4 className="text-sm font-bold text-slate-700 uppercase tracking-tight">Recap Pembagian Per Nama</h4>
          </div>
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="text-slate-400 border-b border-slate-100">
                <th className="px-6 py-4 font-bold text-[10px] uppercase tracking-widest">Penerima Manfaat</th>
                <th className="px-6 py-4 font-bold text-[10px] uppercase tracking-widest text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {Object.entries(
                servings.reduce((acc, curr) => {
                  acc[curr.recipientName] = (acc[curr.recipientName] || 0) + curr.amount;
                  return acc;
                }, {} as Record<string, number>)
              ).sort((a,b) => b[1] - a[1]).map(([name, amount]) => (
                <tr key={name} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 font-bold text-slate-700">{name}</td>
                  <td className="px-6 py-4 text-right font-mono font-bold text-blue-600">{amount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Menu Photo History Recap */}
        <div className="col-span-12">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-1.5 h-6 bg-emerald-600 rounded-full"></div>
            <h4 className="text-lg font-bold text-slate-900 tracking-tight">Rekap Dokumentasi Photo Menu</h4>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {distributions.length === 0 ? (
              <div className="col-span-full py-12 text-center bg-white rounded-xl border border-dashed border-slate-200">
                <FileImage size={40} className="mx-auto text-slate-200 mb-3" />
                <p className="text-slate-400 font-medium italic">Belum ada dokumentasi menu tersedia.</p>
              </div>
            ) : (
              distributions
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                .map((dist, idx) => (
                <motion.div 
                  key={dist.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  transition={{ delay: idx * 0.05 }}
                  viewport={{ once: true }}
                  className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden group hover:shadow-md transition-all flex flex-col"
                >
                  <div className="aspect-[4/3] bg-slate-100 relative overflow-hidden">
                    {dist.photoUrl ? (
                      <img 
                        src={dist.photoUrl} 
                        alt={dist.menuDetails} 
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-slate-300">
                        <FileImage size={48} className="mb-2 opacity-50" />
                        <span className="text-[10px] font-bold uppercase tracking-widest">No Photo</span>
                      </div>
                    )}
                    <div className="absolute top-3 left-3">
                      <div className="bg-white/90 backdrop-blur px-2.5 py-1 rounded-lg text-[10px] font-black text-emerald-900 shadow-sm border border-white/50">
                        {dist.date}
                      </div>
                    </div>
                  </div>
                  <div className="p-4 flex-1 flex flex-col">
                    <div className="flex justify-between items-start mb-2">
                      <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Rincian Menu</h5>
                      <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                        {dist.amount} MBG
                      </span>
                    </div>
                    <p className="text-sm font-bold text-slate-900 leading-snug line-clamp-2">
                      {dist.menuDetails}
                    </p>
                    <div className="mt-auto pt-3 flex items-center gap-2 border-t border-slate-50">
                      <div className="w-5 h-5 rounded-md bg-slate-100 flex items-center justify-center text-slate-400">
                        <User size={12} />
                      </div>
                      <span className="text-[10px] font-medium text-slate-500 italic pr-2 border-r border-slate-100">
                        Oleh: {dist.recipient}
                      </span>
                      <span className="text-[10px] font-bold text-slate-400 tabular-nums">
                        {dist.arrivalTime}
                      </span>
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  </div>
  );
}

// ... existing components (SidebarItem, MobileNavItem) ...
function LandingPage({ onLogin }: { onLogin: () => void }) {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-emerald-50 via-slate-50 to-emerald-100">
      <div className="max-w-4xl w-full grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
        <motion.div 
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          className="space-y-8"
        >
          <div className="inline-flex items-center gap-2 bg-emerald-600/10 text-emerald-700 px-4 py-1.5 rounded-full text-xs font-bold tracking-widest uppercase">
            <Package size={14} />
            SCB Official Tracker
          </div>
          <h1 className="text-6xl md:text-7xl font-bold text-slate-900 leading-[0.95] tracking-tighter">
            MBG<br />
            <span className="text-emerald-700">Digital</span><br />
            Monitoring
          </h1>
          <p className="text-slate-600 text-lg font-medium leading-relaxed max-w-sm">
            Platform verifikasi dan tracking distribusi Makanan Bergizi Gratis untuk civitas Sekolah Cendekia Baznas.
          </p>
          <button 
            onClick={onLogin}
            className="flex items-center gap-3 px-8 py-4 bg-emerald-900 text-white rounded-xl font-bold hover:bg-emerald-800 transition-all active:scale-95 group shadow-xl shadow-emerald-900/20"
          >
            Akses Database MBG
            <Plus className="group-hover:rotate-90 transition-transform" />
          </button>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative hidden md:block"
        >
          <div className="bg-white p-2 rounded-[32px] shadow-2xl rotate-2">
            <img 
              src="https://images.unsplash.com/photo-1547592166-23ac45744acd?auto=format&fit=crop&q=80&w=1000" 
              alt="Healthy Food" 
              className="rounded-[24px] w-full hover:scale-105 transition-transform duration-700 shadow-inner"
              referrerPolicy="no-referrer"
            />
          </div>
          <div className="absolute -bottom-6 -right-6 bg-white p-6 rounded-2xl shadow-xl border-l-[8px] border-emerald-600">
            <h4 className="text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-1">Cendekia Baznas</h4>
            <span className="text-3xl font-bold text-slate-900">Laporan 2026</span>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

function DistributionForm({ onSuccess }: { onSuccess: () => void }) {
  const [loading, setLoading] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    arrivalTime: format(new Date(), 'HH:mm'),
    recipient: '',
    studentOfficer: '',
    menuDetails: '',
    amount: 1,
    photoUrl: '',
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 1024 * 1024) {
        alert('Ukuran file terlalu besar. Maksimum 1MB.');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        setPhotoPreview(base64String);
        setFormData(prev => ({ ...prev, photoUrl: base64String }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const status = calculateStatus(formData.arrivalTime);
      await distributionService.createDistribution({
        ...formData,
        status,
        amount: Number(formData.amount),
        studentOfficer: formData.studentOfficer || "",
        photoUrl: formData.photoUrl || ""
      });
      setFormData({
        date: format(new Date(), 'yyyy-MM-dd'),
        arrivalTime: format(new Date(), 'HH:mm'),
        recipient: '',
        studentOfficer: '',
        menuDetails: '',
        amount: 1,
        photoUrl: '',
      });
      setPhotoPreview(null);
      onSuccess();
    } catch (error) {
      alert('Gagal menyimpan data');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-card p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-bold flex items-center gap-3">
          <div className="w-1 h-6 bg-emerald-600 rounded-full"></div>
          Form Input Distribusi
        </h3>
        <div className="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-1 rounded font-bold uppercase tracking-wider border border-emerald-100">
          Digital Tracking
        </div>
      </div>
      
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">
              Tanggal
            </label>
            <input 
              type="date" 
              required
              value={formData.date}
              onChange={e => setFormData({ ...formData, date: e.target.value })}
              className="input-field"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">
              Jam Tiba
            </label>
            <input 
              type="time" 
              required
              value={formData.arrivalTime}
              onChange={e => setFormData({ ...formData, arrivalTime: e.target.value })}
              className="input-field"
            />
            {formData.arrivalTime && (
              <p className={cn(
                "text-[10px] mt-1 ml-1 font-bold italic",
                calculateStatus(formData.arrivalTime) === 'Tepat Waktu' ? "text-emerald-600" : 
                calculateStatus(formData.arrivalTime) === 'Terlambat' ? "text-red-600" : "text-slate-400"
              )}>
                Ketentuan: {calculateStatus(formData.arrivalTime) || 'Luar Jam Kerja'}
              </p>
            )}
          </div>
        </div>

        <div>
          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">
            Tendik Penerima
          </label>
          <input 
            type="text" 
            required
            placeholder="Ketik nama lengkap penerima..."
            value={formData.recipient}
            onChange={e => setFormData({ ...formData, recipient: e.target.value })}
            className="input-field mb-2"
          />
          <input 
            type="text" 
            placeholder="Petugas Siswa (Opsional)..."
            value={formData.studentOfficer}
            onChange={e => setFormData({ ...formData, studentOfficer: e.target.value })}
            className="input-field py-2 text-xs"
          />
        </div>

        <div>
          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">
            Dokumentasi Menu (Photo)
          </label>
          <div className="relative group">
            <input 
              type="file" 
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
              id="menu-photo"
            />
            <label 
              htmlFor="menu-photo"
              className={cn(
                "flex flex-col items-center justify-center w-full rounded-xl border-2 border-dashed transition-all cursor-pointer overflow-hidden relative",
                photoPreview 
                  ? "aspect-[16/9] border-emerald-500" 
                  : "py-8 border-slate-200 hover:border-emerald-400 hover:bg-emerald-50"
              )}
            >
              {photoPreview ? (
                <>
                  <img 
                    src={photoPreview} 
                    alt="Preview" 
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <div className="bg-white/20 backdrop-blur-md p-3 rounded-full boder border-white/30 text-white">
                      <Camera size={24} />
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center">
                  <div className="w-12 h-12 bg-slate-50 text-slate-400 rounded-full flex items-center justify-center mx-auto mb-3 border border-slate-100 group-hover:text-emerald-500 group-hover:bg-emerald-100 group-hover:border-emerald-200 transition-colors">
                    <ImagePlus size={24} />
                  </div>
                  <p className="text-xs font-bold text-slate-500 group-hover:text-emerald-700">Pilih Foto Menu</p>
                  <p className="text-[10px] text-slate-400 mt-1 italic">Maksimal 1MB</p>
                </div>
              )}
            </label>
          </div>
        </div>

        <div>
          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">
            Rincian Menu
          </label>
          <textarea 
            required
            rows={2}
            placeholder="Contoh: Nasi Putih, Ayam Bakar, Sayur Asem, Buah Jeruk"
            value={formData.menuDetails}
            onChange={e => setFormData({ ...formData, menuDetails: e.target.value })}
            className="input-field resize-none py-3"
          />
        </div>

        <div className="grid grid-cols-1 gap-4">
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">
              Jumlah MBG (Volume)
            </label>
            <input 
              type="number" 
              min="1"
              required
              value={formData.amount}
              onChange={e => setFormData({ ...formData, amount: parseInt(e.target.value) || 0 })}
              className="input-field font-bold text-emerald-700"
            />
          </div>
        </div>

        <button 
          type="submit" 
          disabled={loading}
          className="w-full bg-emerald-900 text-white font-bold py-4 rounded-xl mt-4 shadow-xl shadow-emerald-900/20 hover:bg-emerald-800 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3"
        >
          {loading ? (
            <>
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Memproses Data...
            </>
          ) : (
            <>
              <Plus size={20} />
              Simpan Distribusi MBG
            </>
          )}
        </button>
      </form>
    </div>
  );
}

function RecentActivity({ 
  data, 
  onEdit, 
  onDelete,
  onBulkDelete,
  servings,
  onRefresh
}: { 
  data: Distribution[], 
  onEdit: (item: Distribution) => void,
  onDelete: (id: string) => void,
  onBulkDelete: (ids: string[]) => void,
  servings: Serving[],
  onRefresh: () => void
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const toggleSelectAll = () => {
    if (selectedIds.length === data.length && data.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(data.map(item => item.id!).filter(Boolean));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleBulkDelete = () => {
    if (selectedIds.length === 0) return;
    onBulkDelete(selectedIds);
    setSelectedIds([]);
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full">
      <div className="p-5 border-b border-slate-100 bg-slate-50 flex flex-col gap-3">
        <div className="flex justify-between items-center">
          <h4 className="text-sm font-bold text-slate-700 uppercase tracking-tight">Aktivitas Terbaru</h4>
          <span className="text-[10px] text-slate-400 font-mono italic">Sinkronisasi Real-time</span>
        </div>

        {data.length > 0 && (
          <div className="flex items-center justify-between pt-2 border-t border-slate-100 mt-1">
            <div className="flex items-center gap-3">
              <button 
                onClick={toggleSelectAll}
                className="flex items-center gap-2 text-[10px] font-bold text-slate-500 hover:text-blue-600 transition-colors"
              >
                {selectedIds.length === data.length && data.length > 0 ? (
                  <CheckSquare size={14} className="text-blue-600" />
                ) : (
                  <Square size={14} />
                )}
                {selectedIds.length === data.length ? 'Batal Semua' : 'Pilih Semua'}
              </button>
              {selectedIds.length > 0 && (
                <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                  {selectedIds.length} Terpilih
                </span>
              )}
            </div>
            
            {selectedIds.length > 0 && (
              <button 
                onClick={handleBulkDelete}
                className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-all"
              >
                <Trash2 size={14} />
                Hapus Terpilih
              </button>
            )}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto max-h-[600px]">
        {data.length === 0 ? (
          <div className="py-20 text-center text-slate-400">
            <Package className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p className="font-medium italic">Belum ada rekaman distribusi hari ini.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {data.map((item, idx) => {
              const totalServedForDate = servings
                .filter(s => s.date === item.date)
                .reduce((sum, s) => sum + s.amount, 0);
              const remainingStock = Math.max(0, item.amount - totalServedForDate);
              const progressPercentage = Math.min(100, (totalServedForDate / item.amount) * 100);
              const isSelected = selectedIds.includes(item.id!);

              return (
                <motion.div 
                  key={item.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className={cn(
                    "p-5 transition-colors flex gap-5 group relative",
                    isSelected ? "bg-blue-50/50" : "hover:bg-slate-50"
                  )}
                >
                  <div 
                    onClick={() => toggleSelect(item.id!)}
                    className="shrink-0 flex items-center p-2 -ml-2 hover:bg-white rounded-lg transition-colors cursor-pointer self-start mt-2"
                  >
                    {isSelected ? (
                      <CheckSquare size={18} className="text-blue-600" />
                    ) : (
                      <Square size={18} className="text-slate-300 group-hover:text-blue-400" />
                    )}
                  </div>
                  <div className="w-20 h-20 rounded-xl bg-slate-100 shrink-0 overflow-hidden border border-slate-200">
                    {item.photoUrl ? (
                      <img 
                        src={item.photoUrl} 
                        alt="Menu" 
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-300">
                        <FileImage size={24} />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start mb-1">
                      <p className="text-sm font-bold text-slate-900 truncate leading-tight pr-4">
                        {item.recipient}
                        {item.studentOfficer && (
                          <span className="block text-[10px] font-medium text-slate-400 lowercase italic">
                            bersama {item.studentOfficer}
                          </span>
                        )}
                      </p>
                      <div className="flex items-center gap-2">
                         <span className="text-[10px] font-bold text-slate-400 shrink-0 tabular-nums">
                          {item.date} • {item.arrivalTime}
                        </span>
                        <div className="flex items-center gap-1">
                          <button 
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onEdit(item);
                            }}
                            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-all flex items-center justify-center relative z-20"
                            title="Edit Data"
                          >
                            <Edit size={16} />
                          </button>
                          <button 
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (item.id) {
                                onDelete(item.id);
                              }
                            }}
                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-all flex items-center justify-center cursor-pointer relative z-20"
                            title="Hapus Data"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="mb-2">
                      <p className="text-xs text-slate-500 line-clamp-1 italic font-medium leading-relaxed">
                        "{item.menuDetails}"
                      </p>
                    </div>
                    
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider">
                        <div className="flex items-center gap-2">
                          <div className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full border border-blue-100">
                            {totalServedForDate} TERBAGI
                          </div>
                          <div className={cn(
                            "px-2 py-0.5 rounded-full border",
                            remainingStock > 0 ? "bg-emerald-50 text-emerald-700 border-emerald-100" : "bg-red-50 text-red-700 border-red-100"
                          )}>
                            {remainingStock} SISA
                          </div>
                        </div>
                        <span className="text-slate-400">{item.amount} MBG TOTAL</span>
                      </div>
                      
                      <div className="w-full bg-slate-100 h-1 rounded-full overflow-hidden">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${progressPercentage}%` }}
                          className={cn(
                            "h-full rounded-full transition-all duration-1000",
                            progressPercentage >= 100 ? "bg-blue-600" : "bg-blue-400"
                          )}
                        />
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function EditDistributionModal({ 
  distribution, 
  onClose, 
  onSuccess,
  onDelete
}: { 
  distribution: Distribution, 
  onClose: () => void, 
  onSuccess: () => void,
  onDelete?: (id: string) => void
}) {
  const [loading, setLoading] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(distribution.photoUrl || null);
  const [formData, setFormData] = useState({
    date: distribution.date,
    arrivalTime: distribution.arrivalTime,
    recipient: distribution.recipient,
    studentOfficer: distribution.studentOfficer || '',
    menuDetails: distribution.menuDetails,
    amount: distribution.amount,
    photoUrl: distribution.photoUrl || '',
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 1024 * 1024) {
        alert('Ukuran file terlalu besar. Maksimum 1MB.');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        setPhotoPreview(base64String);
        setFormData(prev => ({ ...prev, photoUrl: base64String }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const status = calculateStatus(formData.arrivalTime);
      await distributionService.updateDistribution(distribution.id!, {
        ...formData,
        status,
        amount: Number(formData.amount),
        studentOfficer: formData.studentOfficer || "",
        photoUrl: formData.photoUrl || ""
      });
      onSuccess();
    } catch (error) {
      alert('Gagal memperbarui data');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
      />
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative bg-white rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden"
      >
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <Edit size={20} className="text-blue-600" />
            Edit Data Distribusi
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <XCircle size={24} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 ml-1">Tanggal</label>
              <input type="date" required value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} className="input-field" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 ml-1">Jam Tiba</label>
              <input type="time" required value={formData.arrivalTime} onChange={e => setFormData({ ...formData, arrivalTime: e.target.value })} className="input-field" />
              {formData.arrivalTime && (
                <p className={cn(
                  "text-[10px] mt-1 font-bold italic",
                  calculateStatus(formData.arrivalTime) === 'Tepat Waktu' ? "text-emerald-600" : 
                  calculateStatus(formData.arrivalTime) === 'Terlambat' ? "text-red-600" : "text-slate-400"
                )}>
                  Ketentuan: {calculateStatus(formData.arrivalTime) || 'Luar Jam Kerja'}
                </p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 ml-1">Tendik Penerima</label>
            <input type="text" required value={formData.recipient} onChange={e => setFormData({ ...formData, recipient: e.target.value })} className="input-field mb-2" />
            <input type="text" placeholder="Petugas Siswa (Opsional)..." value={formData.studentOfficer} onChange={e => setFormData({ ...formData, studentOfficer: e.target.value })} className="input-field py-2 text-xs" />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 ml-1">Update Photo</label>
            <div className="relative group">
              <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" id="edit-menu-photo" />
              <label htmlFor="edit-menu-photo" className={cn("flex flex-col items-center justify-center w-full rounded-xl border-2 border-dashed transition-all cursor-pointer overflow-hidden relative", photoPreview ? "aspect-[16/9] border-blue-500" : "py-6 border-slate-200 hover:border-blue-400")}>
                {photoPreview ? (
                  <>
                    <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Camera size={24} className="text-white" />
                    </div>
                  </>
                ) : (
                  <div className="text-center">
                    <ImagePlus size={24} className="mx-auto text-slate-300 mb-2" />
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Ganti Foto</p>
                  </div>
                )}
              </label>
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 ml-1">Rincian Menu</label>
            <textarea required rows={2} value={formData.menuDetails} onChange={e => setFormData({ ...formData, menuDetails: e.target.value })} className="input-field resize-none py-3" />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 ml-1">Volume (MBG)</label>
            <input type="number" min="1" required value={formData.amount} onChange={e => setFormData({ ...formData, amount: parseInt(e.target.value) || 0 })} className="input-field font-bold text-blue-700" />
          </div>

          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onClose} className="flex-1 py-3 border border-slate-200 rounded-xl font-bold text-slate-600 hover:bg-slate-50 transition-all">Batal</button>
            {onDelete && (
              <button 
                type="button" 
                onClick={() => {
                  if (distribution.id) {
                    onDelete(distribution.id);
                    onClose();
                  }
                }} 
                className="p-3 border border-red-200 text-red-600 rounded-xl hover:bg-red-50 transition-all flex items-center justify-center"
                title="Hapus Data"
              >
                <Trash2 size={20} />
              </button>
            )}
            <button type="submit" disabled={loading} className="flex-[2] bg-blue-600 text-white font-bold py-3 rounded-xl shadow-lg shadow-blue-600/20 hover:bg-blue-700 transition-all flex items-center justify-center gap-2">
              {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Simpan Perubahan'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

function EditServingModal({ 
  serving, 
  onClose, 
  onSuccess,
  distributions,
  servings,
  onDelete
}: { 
  serving: Serving, 
  onClose: () => void, 
  onSuccess: () => void,
  distributions: Distribution[],
  servings: Serving[],
  onDelete?: (id: string) => void
}) {
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    date: serving.date,
    time: serving.time || format(new Date(), 'HH:mm'),
    recipientName: serving.recipientName,
    amount: serving.amount,
    returnedAmount: serving.returnedAmount || 0,
    qualityControl: serving.qualityControl || 'Baik' as 'Baik' | 'Kurang' | 'Tidak Layak',
  });

  // Calculate total received for this date
  const totalReceivedForDate = distributions
    .filter(d => d.date === formData.date)
    .reduce((sum, d) => sum + d.amount, 0);

  // Calculate total served for this date (excluding current serving being edited)
  const totalServedForOthers = servings
    .filter(s => s.date === formData.date && s.id !== serving.id)
    .reduce((sum, s) => sum + s.amount, 0);

  const availableStock = totalReceivedForDate - totalServedForOthers;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formData.amount > availableStock) {
      alert(`Jumlah yang diberikan (${formData.amount}) melebihi stok yang tersedia (${availableStock}) untuk tanggal ini.`);
      return;
    }

    if (formData.returnedAmount > formData.amount) {
      alert(`Jumlah kembali (${formData.returnedAmount}) tidak boleh melebihi jumlah yang diberikan (${formData.amount}).`);
      return;
    }

    setLoading(true);
    try {
      await distributionService.updateServing(serving.id!, {
        ...formData,
        amount: Number(formData.amount),
        returnedAmount: Number(formData.returnedAmount),
      });
      onSuccess();
    } catch (error) {
      alert('Gagal memperbarui data pembagian');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
      />
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden"
      >
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <Edit size={20} className="text-blue-600" />
            {step === 1 ? 'Edit Quality Check' : 'Edit Detail Pembagian'}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <XCircle size={24} />
          </button>
        </div>
        
        <div className="p-6">
          <AnimatePresence mode="wait">
            {step === 1 ? (
              <motion.div
                key="edit-step1"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="space-y-6"
              >
                <div className="p-5 bg-slate-50 border border-slate-100 rounded-2xl">
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-4 text-center">
                    Verifikasi Ulang Kualitas
                  </label>
                  <div className="grid grid-cols-1 gap-3">
                    {['Baik', 'Kurang', 'Tidak Layak'].map((option) => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => setFormData({ ...formData, qualityControl: option as any })}
                        className={cn(
                          "relative py-4 px-5 rounded-xl text-sm font-bold border transition-all flex items-center justify-between",
                          formData.qualityControl === option
                            ? option === 'Baik' ? "bg-emerald-50 text-emerald-700 border-emerald-200 shadow-sm" :
                              option === 'Kurang' ? "bg-amber-50 text-amber-700 border-amber-200 shadow-sm" :
                              "bg-red-50 text-red-700 border-red-200 shadow-sm"
                            : "bg-white text-slate-400 border-slate-100 hover:border-slate-200"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "w-3 h-3 rounded-full shadow-inner",
                            option === 'Baik' ? "bg-emerald-500" : option === 'Kurang' ? "bg-amber-500" : "bg-red-500"
                          )}></div>
                          <span>{option}</span>
                        </div>
                        {formData.qualityControl === option && (
                          <CheckCircle2 size={16} className={cn(
                            option === 'Baik' ? "text-emerald-600" : option === 'Kurang' ? "text-amber-600" : "text-red-600"
                          )} />
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                <button 
                  type="button"
                  onClick={() => setStep(2)}
                  className="w-full bg-blue-600 text-white font-bold py-4 rounded-xl shadow-xl shadow-blue-600/20 hover:bg-blue-700 transition-all flex items-center justify-center gap-2 group"
                >
                  Lanjut ke Detail
                  <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />
                </button>
              </motion.div>
            ) : (
              <motion.div
                key="edit-step2"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
              >
                <form onSubmit={handleSubmit} className="space-y-5">
                   <div className={cn(
                    "p-3 rounded-lg flex items-center justify-between border mb-4",
                    formData.qualityControl === 'Baik' ? "bg-emerald-50 border-emerald-100" :
                    formData.qualityControl === 'Kurang' ? "bg-amber-50 border-amber-100" :
                    "bg-red-50 border-red-100"
                  )}>
                    <div className="flex items-center gap-2">
                       <ShieldCheck size={14} className={cn(
                        formData.qualityControl === 'Baik' ? "text-emerald-600" :
                        formData.qualityControl === 'Kurang' ? "text-amber-600" :
                        "text-red-600"
                      )} />
                      <span className={cn(
                        "text-[10px] font-bold uppercase tracking-wider",
                         formData.qualityControl === 'Baik' ? "text-emerald-700" :
                         formData.qualityControl === 'Kurang' ? "text-amber-700" :
                         "text-red-700"
                      )}>
                        QC: {formData.qualityControl}
                      </span>
                      <button 
                        type="button"
                        onClick={() => setStep(1)}
                        className="text-[10px] font-bold text-blue-600 uppercase tracking-widest hover:underline ml-auto"
                      >
                        Ubah
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">
                        Tanggal
                      </label>
                      <input type="date" required value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} className="input-field" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">
                        Jam Pembagian
                      </label>
                      <input type="time" required value={formData.time} onChange={e => setFormData({ ...formData, time: e.target.value })} className="input-field" />
                    </div>
                  </div>
                  
                  <div className="text-[10px] text-slate-400 mt-1 ml-1 italic">
                    Stok Tersedia: <span className="font-bold text-blue-600">{availableStock}</span> unit
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">
                      Nama Penerima
                    </label>
                    <input type="text" required placeholder="Ketik nama penerima..." value={formData.recipientName} onChange={e => setFormData({ ...formData, recipientName: e.target.value })} className="input-field" />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">
                        Jumlah Diberikan
                      </label>
                      <input type="number" min="1" max={availableStock > 0 ? availableStock : 1} required value={formData.amount} onChange={e => setFormData({ ...formData, amount: parseInt(e.target.value) || 0 })} className="input-field font-bold text-blue-700" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">
                        Jumlah Kembali
                      </label>
                      <input type="number" min="0" max={formData.amount} value={formData.returnedAmount} onChange={e => {
                        const val = parseInt(e.target.value) || 0;
                        setFormData({ ...formData, returnedAmount: val > formData.amount ? formData.amount : val });
                      }} className="input-field font-bold text-amber-600" />
                    </div>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button type="button" onClick={onClose} className="flex-1 py-3 border border-slate-200 rounded-xl font-bold text-slate-600 hover:bg-slate-50 transition-all text-sm">Batal</button>
                    {onDelete && (
                      <button 
                        type="button" 
                        onClick={() => {
                          if (serving.id) {
                            onDelete(serving.id);
                            onClose();
                          }
                        }}
                        className="p-3 border border-red-200 text-red-600 rounded-xl hover:bg-red-50 transition-all flex items-center justify-center"
                        title="Hapus Data"
                      >
                        <Trash2 size={20} />
                      </button>
                    )}
                    <button type="submit" disabled={loading || formData.amount > availableStock} className="flex-[2] bg-blue-600 text-white font-bold py-3 rounded-xl shadow-lg shadow-blue-600/20 hover:bg-blue-700 transition-all flex items-center justify-center gap-2 text-sm">
                      {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Simpan Perubahan'}
                    </button>
                  </div>
                </form>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}

function SidebarItem({ active, onClick, icon, label }: any) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all font-medium text-sm",
        active 
          ? "bg-white/10 text-white" 
          : "text-white/70 hover:bg-white/5 hover:text-white"
      )}
    >
      {React.cloneElement(icon, { size: 18 })}
      {label}
    </button>
  );
}

function MobileNavItem({ active, onClick, icon, label }: any) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-1 p-2 transition-all",
        active ? "text-white" : "text-white/50"
      )}
    >
      {icon}
      <span className="text-[10px] font-bold tracking-tight uppercase">{label}</span>
    </button>
  );
}
