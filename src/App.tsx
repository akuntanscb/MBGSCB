/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
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
  Trash2
} from 'lucide-react';
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

type Tab = 'input' | 'pembagian' | 'laporan';

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('input');
  const [distributions, setDistributions] = useState<Distribution[]>([]);
  const [servings, setServings] = useState<Serving[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [editingDistribution, setEditingDistribution] = useState<Distribution | null>(null);

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

  const handleDeleteDistribution = async (id: string) => {
    if (window.confirm('Apakah Anda yakin ingin menghapus data distribusi ini?')) {
      try {
        await distributionService.deleteDistribution(id);
        setRefreshKey(prev => prev + 1);
      } catch (error) {
        alert('Gagal menghapus data');
      }
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
                  <div className="col-span-12 lg:col-span-5">
                    <PembagianForm onSuccess={() => setRefreshKey(prev => prev + 1)} />
                  </div>
                  <div className="col-span-12 lg:col-span-7">
                    <RecentServingActivity data={servings} />
                  </div>
                </div>
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

function PembagianForm({ onSuccess }: { onSuccess: () => void }) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    recipientName: '',
    amount: 1,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await distributionService.createServing({
        ...formData,
        amount: Number(formData.amount),
      });
      setFormData({
        date: format(new Date(), 'yyyy-MM-dd'),
        recipientName: '',
        amount: 1,
      });
      onSuccess();
    } catch (error) {
      alert('Gagal menyimpan data pembagian');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-card p-6">
      <h3 className="text-lg font-bold mb-6 flex items-center gap-3">
        <div className="w-1 h-6 bg-blue-600 rounded-full"></div>
        Input Proses Pembagian
      </h3>
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
            Tanggal & Hari
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
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
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
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
            Jumlah yang Diberikan
          </label>
          <input 
            type="number" 
            min="1"
            required
            value={formData.amount}
            onChange={e => setFormData({ ...formData, amount: parseInt(e.target.value) || 0 })}
            className="input-field"
          />
        </div>

        <button 
          type="submit" 
          disabled={loading}
          className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg mt-4 shadow-lg shadow-blue-600/20 hover:bg-blue-700 transition-colors active:scale-95 disabled:opacity-50"
        >
          {loading ? 'Mengirim Data...' : 'Simpan Data Pembagian'}
        </button>
      </form>
    </div>
  );
}

function RecentServingActivity({ data }: { data: Serving[] }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full">
      <div className="p-5 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
        <h4 className="text-sm font-bold text-slate-700 uppercase tracking-tight">Riwayat Pembagian</h4>
        <span className="text-[10px] text-slate-400 font-mono italic">Database Update</span>
      </div>

      <div className="flex-1 overflow-y-auto max-h-[500px]">
        {data.length === 0 ? (
          <div className="py-20 text-center text-slate-400">
            <HandHeart className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p className="font-medium italic">Belum ada rekaman pembagian.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {data.map((item, idx) => (
              <motion.div 
                key={item.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: idx * 0.05 }}
                className="p-5 hover:bg-slate-50 transition-colors flex items-center gap-5"
              >
                <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center shrink-0">
                  <HandHeart size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center mb-0.5">
                    <p className="text-sm font-bold text-slate-900 truncate">{item.recipientName}</p>
                    <span className="text-[10px] font-bold text-slate-400">{item.date}</span>
                  </div>
                  <p className="text-xs text-slate-500">
                    Menerima <span className="font-bold text-blue-600">{item.amount} MBG</span>
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ReportSection({ distributions, servings }: { distributions: Distribution[], servings: Serving[] }) {
  const statsByMenu = distributions.reduce((acc, curr) => {
    acc[curr.menuDetails] = (acc[curr.menuDetails] || 0) + curr.amount;
    return acc;
  }, {} as Record<string, number>);

  const statsByTendik = distributions.reduce((acc, curr) => {
    acc[curr.recipient] = (acc[curr.recipient] || 0) + curr.amount;
    return acc;
  }, {} as Record<string, number>);

  const totalDistributed = distributions.reduce((sum, item) => sum + item.amount, 0);
  const totalServed = servings.reduce((sum, item) => sum + item.amount, 0);
  const stockRemaining = totalDistributed - totalServed;

  return (
    <div className="space-y-10">
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

      <div className="grid grid-cols-12 gap-8">
        {/* Reports by Menu */}
        <div className="col-span-12 lg:col-span-12 bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="p-5 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
            <h4 className="text-sm font-bold text-slate-700 uppercase tracking-tight">Akumulasi Stok Per Menu</h4>
          </div>
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="text-slate-400 border-b border-slate-100">
                <th className="px-6 py-4 font-bold text-[10px] uppercase tracking-widest">Rincian Menu</th>
                <th className="px-6 py-4 font-bold text-[10px] uppercase tracking-widest text-right">Volume</th>
                <th className="px-6 py-4 font-bold text-[10px] uppercase tracking-widest text-right">Progress Stok</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {Object.entries(statsByMenu).sort((a,b) => b[1] - a[1]).map(([menu, amount]) => (
                <tr key={menu} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 font-bold text-slate-700 max-w-xs truncate">{menu}</td>
                  <td className="px-6 py-4 text-right font-mono font-bold text-emerald-600">{amount}</td>
                  <td className="px-6 py-4 text-right w-64">
                    <div className="flex items-center gap-3">
                      <div className="h-1.5 flex-1 bg-slate-100 rounded-full overflow-hidden">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${(amount / totalDistributed) * 100}%` }}
                          className="h-full bg-emerald-500"
                        />
                      </div>
                      <span className="text-[10px] font-bold text-emerald-500 w-8">{((amount / totalDistributed) * 100).toFixed(0)}%</span>
                    </div>
                  </td>
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
      await distributionService.createDistribution({
        ...formData,
        amount: Number(formData.amount),
        studentOfficer: formData.studentOfficer || undefined,
        photoUrl: formData.photoUrl || undefined
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
  onDelete 
}: { 
  data: Distribution[], 
  onEdit: (item: Distribution) => void,
  onDelete: (id: string) => void
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full">
      <div className="p-5 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
        <h4 className="text-sm font-bold text-slate-700 uppercase tracking-tight">Aktivitas Terbaru</h4>
        <span className="text-[10px] text-slate-400 font-mono italic">Sinkronisasi Real-time</span>
      </div>

      <div className="flex-1 overflow-y-auto max-h-[600px]">
        {data.length === 0 ? (
          <div className="py-20 text-center text-slate-400">
            <Package className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p className="font-medium italic">Belum ada rekaman distribusi hari ini.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {data.map((item, idx) => (
              <motion.div 
                key={item.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="p-5 hover:bg-slate-50 transition-colors flex gap-5 group"
              >
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
                        {item.date}
                      </span>
                      <div className="hidden group-hover:flex items-center gap-1">
                        <button 
                          onClick={() => onEdit(item)}
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-all"
                          title="Edit Data"
                        >
                          <Edit size={14} />
                        </button>
                        <button 
                          onClick={() => onDelete(item.id)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-all"
                          title="Hapus Data"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="mb-2">
                    <p className="text-xs text-slate-500 line-clamp-2 italic font-medium leading-relaxed">
                      "{item.menuDetails}"
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full text-[10px] font-black tracking-widest uppercase border border-emerald-100">
                      {item.amount} MBG
                    </div>
                    <div className="bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest">
                      Terkirim
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function EditDistributionModal({ 
  distribution, 
  onClose, 
  onSuccess 
}: { 
  distribution: Distribution, 
  onClose: () => void, 
  onSuccess: () => void 
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
      await distributionService.updateDistribution(distribution.id, {
        ...formData,
        amount: Number(formData.amount),
        studentOfficer: formData.studentOfficer || undefined,
        photoUrl: formData.photoUrl || undefined
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
            <button type="submit" disabled={loading} className="flex-[2] bg-blue-600 text-white font-bold py-3 rounded-xl shadow-lg shadow-blue-600/20 hover:bg-blue-700 transition-all flex items-center justify-center gap-2">
              {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Simpan Perubahan'}
            </button>
          </div>
        </form>
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
