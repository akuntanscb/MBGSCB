import React, { useState, useMemo } from 'react';
import { 
  MapPin, 
  Clock, 
  Calendar, 
  AlertTriangle, 
  CheckCircle2, 
  RefreshCw, 
  Search, 
  Copy, 
  Check, 
  Download, 
  Building2, 
  Utensils, 
  RotateCcw,
  Sparkles,
  Layers,
  ChevronRight,
  AlertCircle,
  Package,
  Send,
  X,
  FileSpreadsheet
} from 'lucide-react';
import { Distribution, Serving } from '../types';
import { distributionService } from '../services/distributionService';
import { SCB_LOGO_DATA_URL } from '../constants';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface UnreturnedTrackingProps {
  servings: Serving[];
  distributions: Distribution[];
  onRefresh: () => void;
  onNavigateToPembagian?: () => void;
}

export function UnreturnedTrackingSection({
  servings,
  distributions,
  onRefresh,
  onNavigateToPembagian
}: UnreturnedTrackingProps) {
  // Filters & State
  const [searchQuery, setSearchQuery] = useState('');
  const [timeFilter, setTimeFilter] = useState<'all' | 'today' | 'yesterday' | 'overdue'>('all');
  const [statusFilter, setStatusFilter] = useState<'unreturned_only' | 'partial_only' | 'all'>('unreturned_only');
  const [viewMode, setViewMode] = useState<'grouped_location' | 'chronological' | 'kitchen_stock'>('grouped_location');
  const [sortBy, setSortBy] = useState<'oldest' | 'most_unreturned' | 'newest'>('oldest');
  
  // Quick return modal state
  const [activeReturnServing, setActiveReturnServing] = useState<Serving | null>(null);
  const [additionalReturnQty, setAdditionalReturnQty] = useState<number>(0);
  const [isUpdating, setIsUpdating] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  // Today string YYYY-MM-DD
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  
  // Calculate yesterday string
  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterdayStr = yesterdayDate.toISOString().split('T')[0];

  // Helper to determine time latency & status
  const getTimeElapsedInfo = (dateStr: string, timeStr: string) => {
    try {
      const [year, month, day] = dateStr.split('-').map(Number);
      const [hours, minutes] = (timeStr || '12:00').split(':').map(Number);
      const servingDate = new Date(year, (month || 1) - 1, day || 1, hours || 0, minutes || 0);
      
      const diffMs = now.getTime() - servingDate.getTime();
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      let badgeColor = 'bg-blue-50 text-blue-700 border-blue-200';
      let urgencyText = 'Baru dibagikan';
      let isOverdue = false;

      if (dateStr === todayStr) {
        if (diffHours < 3) {
          urgencyText = diffHours <= 0 ? 'Baru saja (< 1 jam)' : `${diffHours} jam lalu`;
          badgeColor = 'bg-emerald-50 text-emerald-700 border-emerald-200';
        } else if (diffHours < 6) {
          urgencyText = `${diffHours} jam lalu (Waktu Jemput)`;
          badgeColor = 'bg-amber-50 text-amber-700 border-amber-200';
          isOverdue = true;
        } else {
          urgencyText = `${diffHours} jam lalu (Terlambat)`;
          badgeColor = 'bg-orange-50 text-orange-700 border-orange-200';
          isOverdue = true;
        }
      } else if (dateStr === yesterdayStr) {
        urgencyText = 'Kemarin (H+1)';
        badgeColor = 'bg-rose-50 text-rose-700 border-rose-200';
        isOverdue = true;
      } else {
        const daysAgo = Math.max(2, diffDays);
        urgencyText = `${daysAgo} hari yang lalu (Kritis)`;
        badgeColor = 'bg-red-100 text-red-800 border-red-300 font-bold';
        isOverdue = true;
      }

      return { diffHours, diffDays, urgencyText, badgeColor, isOverdue };
    } catch {
      return { 
        diffHours: 0, 
        diffDays: 0, 
        urgencyText: 'Waktu tidak valid', 
        badgeColor: 'bg-slate-50 text-slate-700 border-slate-200',
        isOverdue: false 
      };
    }
  };

  // Map servings with related distribution and unreturned calculations
  const enrichedServings = useMemo(() => {
    return servings.map(serving => {
      const relatedDist = distributions.find(d => d.date === serving.date);
      const given = serving.amount || 0;
      const returned = serving.returnedAmount || 0;
      const unreturned = Math.max(0, given - returned);
      const returnPct = given > 0 ? Math.round((returned / given) * 100) : 0;
      const timeInfo = getTimeElapsedInfo(serving.date, serving.time);

      return {
        ...serving,
        relatedDist,
        given,
        returned,
        unreturned,
        returnPct,
        timeInfo
      };
    });
  }, [servings, distributions, todayStr, yesterdayStr]);

  // Filtered servings
  const filteredServings = useMemo(() => {
    return enrichedServings.filter(item => {
      // Status filter
      if (statusFilter === 'unreturned_only' && item.unreturned <= 0) return false;
      if (statusFilter === 'partial_only' && (item.returned <= 0 || item.unreturned <= 0)) return false;

      // Time filter
      if (timeFilter === 'today' && item.date !== todayStr) return false;
      if (timeFilter === 'yesterday' && item.date !== yesterdayStr) return false;
      if (timeFilter === 'overdue' && !item.timeInfo.isOverdue) return false;

      // Search query filter (location / recipient / menu)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const locMatch = (item.recipientName || '').toLowerCase().includes(q);
        const menuMatch = (item.relatedDist?.menuDetails || '').toLowerCase().includes(q);
        const dateMatch = (item.date || '').includes(q);
        if (!locMatch && !menuMatch && !dateMatch) return false;
      }

      return true;
    }).sort((a, b) => {
      if (sortBy === 'oldest') {
        // Oldest date and time first
        return a.date.localeCompare(b.date) || (a.time || '').localeCompare(b.time || '');
      } else if (sortBy === 'most_unreturned') {
        return b.unreturned - a.unreturned;
      } else {
        // newest first
        return b.date.localeCompare(a.date) || (b.time || '').localeCompare(a.time || '');
      }
    });
  }, [enrichedServings, statusFilter, timeFilter, searchQuery, sortBy, todayStr, yesterdayStr]);

  // Grouped by Location summary
  const groupedByLocation = useMemo(() => {
    const map = new Map<string, {
      locationName: string;
      totalGiven: number;
      totalReturned: number;
      totalUnreturned: number;
      earliestDate: string;
      latestDate: string;
      sessions: typeof enrichedServings;
    }>();

    // Group only items that match current filter (or active unreturned)
    filteredServings.forEach(item => {
      const locKey = (item.recipientName || 'Tanpa Lokasi').trim();
      const existing = map.get(locKey);
      if (existing) {
        existing.totalGiven += item.given;
        existing.totalReturned += item.returned;
        existing.totalUnreturned += item.unreturned;
        existing.sessions.push(item);
        if (item.date < existing.earliestDate) existing.earliestDate = item.date;
        if (item.date > existing.latestDate) existing.latestDate = item.date;
      } else {
        map.set(locKey, {
          locationName: locKey,
          totalGiven: item.given,
          totalReturned: item.returned,
          totalUnreturned: item.unreturned,
          earliestDate: item.date,
          latestDate: item.date,
          sessions: [item]
        });
      }
    });

    return Array.from(map.values()).sort((a, b) => b.totalUnreturned - a.totalUnreturned);
  }, [filteredServings]);

  // Kitchen inventory leftovers (Distributions received vs served per date)
  const kitchenLeftovers = useMemo(() => {
    const dates = Array.from(new Set(distributions.map(d => d.date))).sort((a, b) => b.localeCompare(a));
    return dates.map(date => {
      const dists = distributions.filter(d => d.date === date);
      const servs = servings.filter(s => s.date === date);
      
      const totalReceived = dists.reduce((sum, d) => sum + (d.amount || 0), 0);
      const totalServed = servs.reduce((sum, s) => sum + (s.amount || 0), 0);
      const unservedStock = Math.max(0, totalReceived - totalServed);
      const totalReturned = servs.reduce((sum, s) => sum + (s.returnedAmount || 0), 0);
      const unreturnedContainers = Math.max(0, totalServed - totalReturned);

      return {
        date,
        menus: dists.map(d => d.menuDetails).filter(Boolean).join(', '),
        officers: dists.map(d => d.studentOfficer).filter(Boolean).join(', '),
        totalReceived,
        totalServed,
        unservedStock,
        totalReturned,
        unreturnedContainers
      };
    });
  }, [distributions, servings]);

  // Overall KPIs
  const totalUnreturnedOverall = useMemo(() => {
    return enrichedServings.reduce((sum, s) => sum + s.unreturned, 0);
  }, [enrichedServings]);

  const totalLocationsWithUnreturned = useMemo(() => {
    const set = new Set<string>();
    enrichedServings.forEach(s => {
      if (s.unreturned > 0) set.add((s.recipientName || '').trim());
    });
    return set.size;
  }, [enrichedServings]);

  const totalOverdueItems = useMemo(() => {
    return enrichedServings.filter(s => s.unreturned > 0 && s.timeInfo.isOverdue).reduce((sum, s) => sum + s.unreturned, 0);
  }, [enrichedServings]);

  const overallReturnRate = useMemo(() => {
    const totalGiven = enrichedServings.reduce((sum, s) => sum + s.given, 0);
    const totalReturned = enrichedServings.reduce((sum, s) => sum + s.returned, 0);
    return totalGiven > 0 ? Math.round((totalReturned / totalGiven) * 100) : 0;
  }, [enrichedServings]);

  // Action: Open Return Modal
  const handleOpenReturnModal = (serving: Serving) => {
    setActiveReturnServing(serving);
    const unret = Math.max(0, (serving.amount || 0) - (serving.returnedAmount || 0));
    setAdditionalReturnQty(unret); // default to full remaining
  };

  // Action: Save quick return
  const handleSaveReturn = async () => {
    if (!activeReturnServing?.id) return;
    const currentReturned = activeReturnServing.returnedAmount || 0;
    const maxPossible = activeReturnServing.amount || 0;
    const newReturned = Math.min(maxPossible, currentReturned + additionalReturnQty);

    setIsUpdating(true);
    try {
      await distributionService.updateServing(activeReturnServing.id, {
        returnedAmount: newReturned
      });
      setActiveReturnServing(null);
      onRefresh();
    } catch (e) {
      console.error(e);
      alert('Gagal memperbarui data pengembalian');
    } finally {
      setIsUpdating(false);
    }
  };

  // Action: 1-Click Mark All Returned for a Serving
  const handleMarkAllReturned = async (serving: Serving) => {
    if (!serving.id) return;
    const unret = Math.max(0, (serving.amount || 0) - (serving.returnedAmount || 0));
    if (unret <= 0) return;

    if (!window.confirm(`Konfirmasi pelunasan pengembalian untuk ${serving.recipientName}?\nSemua ${unret} wadah akan dicatat sudah kembali.`)) {
      return;
    }

    try {
      await distributionService.updateServing(serving.id, {
        returnedAmount: serving.amount || 0
      });
      onRefresh();
    } catch (e) {
      console.error(e);
      alert('Gagal memperbarui pengembalian');
    }
  };

  // Action: Copy WhatsApp broadcast text
  const handleCopyWhatsAppReminder = () => {
    const unreturnedList = groupedByLocation.filter(g => g.totalUnreturned > 0);
    if (unreturnedList.length === 0) {
      alert('Semua wadah/ompreng sudah dikembalikan! Tidak ada sisa yang perlu ditagih.');
      return;
    }

    let text = `📢 *PEMBERITAHUAN PENGEMBALIAN WADAH MBG*\n`;
    text += `*Sekolah Cendekia BAZNAS (SCB)*\n`;
    text += `Tanggal: ${todayStr} • Jam: ${now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB\n\n`;
    text += `Mohon bantuan Bapak/Ibu Wali Asrama, Guru Piket, dan Pengurus Kelas untuk mengarahkan siswa mengembalikan sisa wadah/ompreng ke Dapur Utama SCB:\n\n`;

    unreturnedList.forEach((group, idx) => {
      text += `${idx + 1}. *${group.locationName}*: ${group.totalUnreturned} wadah tertahan\n`;
      // show session breakdown if multiple
      group.sessions.filter(s => s.unreturned > 0).forEach(s => {
        text += `   - Sesi ${s.date} (pk ${s.time}): sisa ${s.unreturned} dari ${s.given} wadah\n`;
      });
    });

    text += `\n*Total Wadah Belum Kembali: ${totalUnreturnedOverall} Ompreng/Wadah*\n`;
    text += `Dimohon kerja samanya agar wadah dapat segera dicuci dan dipersiapkan untuk sesi berikutnya. Terima kasih 🙏`;

    navigator.clipboard.writeText(text);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 3000);
  };

  // Action: Download PDF Checklist
  const handleDownloadPDF = () => {
    const doc = new jsPDF() as any;

    // Header Background
    doc.setFillColor(1, 64, 45); // SCB Emerald
    doc.rect(0, 0, 210, 36, 'F');

    // Title & Info
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(255, 255, 255);
    doc.text('LEMBAR KONTROL & PELACAKAN SISA WADAH MBG', 15, 16);
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(250, 204, 21); // Gold
    doc.text('SEKOLAH CENDEKIA BAZNAS (SCB) - MONITORING & LOGISTIK', 15, 24);

    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);
    doc.text(`Dicetak: ${todayStr} ${now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB`, 15, 30);
    doc.text(`Total Belum Kembali: ${totalUnreturnedOverall} Wadah (${totalLocationsWithUnreturned} Lokasi)`, 130, 30);

    // Table Data
    const tableData = filteredServings.map((s, idx) => [
      idx + 1,
      s.recipientName,
      `${s.date}\n${s.time}`,
      s.timeInfo.urgencyText,
      s.relatedDist?.menuDetails || '-',
      s.given,
      s.returned,
      s.unreturned,
      s.unreturned === 0 ? 'LUNAS' : s.returned > 0 ? 'SEBAGIAN' : 'BELUM'
    ]);

    autoTable(doc, {
      startY: 42,
      head: [['No', 'Lokasi / Penerima', 'Waktu Bagi', 'Status Waktu', 'Menu MBG', 'Bagi', 'Retur', 'Sisa', 'Status']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [1, 64, 45], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
      styles: { fontSize: 7, cellPadding: 2 },
      columnStyles: {
        0: { cellWidth: 8, halign: 'center' },
        1: { cellWidth: 35, fontStyle: 'bold' },
        2: { cellWidth: 20, halign: 'center' },
        3: { cellWidth: 26 },
        4: { cellWidth: 45 },
        5: { cellWidth: 12, halign: 'center' },
        6: { cellWidth: 12, halign: 'center' },
        7: { cellWidth: 14, halign: 'center', fontStyle: 'bold', textColor: [180, 0, 0] },
        8: { cellWidth: 18, halign: 'center' }
      }
    });

    const finalY = ((doc as any).lastAutoTable?.finalY || 180) + 12;

    // Signatures
    if (finalY < 260) {
      doc.setFontSize(8);
      doc.setTextColor(100, 100, 100);
      doc.text('Petugas Logistik / Penjemput Wadah,', 25, finalY);
      doc.text('Penanggung Jawab Dapur SCB,', 135, finalY);

      doc.line(25, finalY + 22, 75, finalY + 22);
      doc.line(135, finalY + 22, 185, finalY + 22);

      doc.text('( ......................................... )', 25, finalY + 27);
      doc.text('( ......................................... )', 135, finalY + 27);
    }

    doc.save(`SCB_Pelacakan_Sisa_Wadah_${todayStr}.pdf`);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner / Announcement */}
      <div className="bg-gradient-to-r from-emerald-900 via-emerald-800 to-teal-900 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
        <div className="absolute -right-8 -bottom-8 w-48 h-48 bg-white/5 rounded-full blur-2xl pointer-events-none"></div>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-700/50 text-emerald-200 border border-emerald-600/50 text-xs font-semibold uppercase tracking-wider mb-2">
              <RotateCcw size={13} className="text-yellow-400" />
              Sistem Pelacakan Wadah & Sisa MBG
            </div>
            <h3 className="text-xl md:text-2xl font-black tracking-tight text-white flex items-center gap-2.5">
              Informasi Kapan & Dimana Sisa Belum Kembali
            </h3>
            <p className="text-emerald-100/80 text-xs md:text-sm mt-1 max-w-2xl leading-relaxed">
              Memantau secara akurat letak wadah/ompreng yang masih tertahan di kelas atau asrama, durasi keterlambatan, serta sisa porsi yang belum dikembalikan ke dapur.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              onClick={handleCopyWhatsAppReminder}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 border border-emerald-400/40"
              title="Salin rekap siap kirim ke WhatsApp grup"
            >
              {copySuccess ? <Check size={16} className="text-yellow-300" /> : <Copy size={16} />}
              <span>{copySuccess ? 'Tersalin ke Clipboard!' : 'Salin Tagihan WA'}</span>
            </button>
            <button
              onClick={handleDownloadPDF}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-white text-emerald-950 hover:bg-emerald-50 rounded-xl text-xs font-bold transition-all shadow-md active:scale-95"
            >
              <Download size={16} className="text-emerald-700" />
              <span>Cetak Checklist PDF</span>
            </button>
            <button
              onClick={onRefresh}
              className="p-2.5 bg-emerald-800/80 hover:bg-emerald-700 text-white rounded-xl text-xs transition-all border border-emerald-600/40"
              title="Perbarui Data"
            >
              <RefreshCw size={16} />
            </button>
          </div>
        </div>

        {/* 4 KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 mt-6 pt-5 border-t border-emerald-700/50">
          <div className="bg-emerald-950/40 backdrop-blur-md rounded-xl p-3.5 border border-emerald-700/40">
            <div className="flex items-center justify-between text-emerald-300 text-xs font-semibold mb-1">
              <span>Total Sisa Wadah</span>
              <AlertCircle size={15} className="text-yellow-400" />
            </div>
            <div className="text-2xl md:text-3xl font-black text-white flex items-baseline gap-1.5">
              <span>{totalUnreturnedOverall}</span>
              <span className="text-xs text-emerald-300 font-medium">wadah</span>
            </div>
            <p className="text-[10px] text-emerald-300/70 mt-1">Tertahan di seluruh lokasi</p>
          </div>

          <div className="bg-emerald-950/40 backdrop-blur-md rounded-xl p-3.5 border border-emerald-700/40">
            <div className="flex items-center justify-between text-emerald-300 text-xs font-semibold mb-1">
              <span>Lokasi Tertahan</span>
              <MapPin size={15} className="text-emerald-400" />
            </div>
            <div className="text-2xl md:text-3xl font-black text-white flex items-baseline gap-1.5">
              <span>{totalLocationsWithUnreturned}</span>
              <span className="text-xs text-emerald-300 font-medium">titik</span>
            </div>
            <p className="text-[10px] text-emerald-300/70 mt-1">Kelas, asrama, atau unit</p>
          </div>

          <div className="bg-emerald-950/40 backdrop-blur-md rounded-xl p-3.5 border border-emerald-700/40">
            <div className="flex items-center justify-between text-emerald-300 text-xs font-semibold mb-1">
              <span>Sisa Terlambat (&gt;4 jam)</span>
              <Clock size={15} className="text-amber-400" />
            </div>
            <div className="text-2xl md:text-3xl font-black text-amber-300 flex items-baseline gap-1.5">
              <span>{totalOverdueItems}</span>
              <span className="text-xs text-amber-300/80 font-medium">wadah</span>
            </div>
            <p className="text-[10px] text-emerald-300/70 mt-1">Perlu penjemputan segera</p>
          </div>

          <div className="bg-emerald-950/40 backdrop-blur-md rounded-xl p-3.5 border border-emerald-700/40">
            <div className="flex items-center justify-between text-emerald-300 text-xs font-semibold mb-1">
              <span>Tingkat Pengembalian</span>
              <CheckCircle2 size={15} className="text-emerald-400" />
            </div>
            <div className="text-2xl md:text-3xl font-black text-emerald-200 flex items-baseline gap-1.5">
              <span>{overallReturnRate}%</span>
              <span className="text-xs text-emerald-300/80 font-medium">lunas</span>
            </div>
            <div className="w-full bg-emerald-900/80 rounded-full h-1.5 mt-2 overflow-hidden">
              <div 
                className="bg-gradient-to-r from-yellow-400 to-emerald-400 h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, Math.max(0, overallReturnRate))}%` }}
              ></div>
            </div>
          </div>
        </div>
      </div>

      {/* Control Bar: View Modes, Search & Filters */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-4">
        {/* View Mode Tabs */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl">
            <button
              onClick={() => setViewMode('grouped_location')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'grouped_location'
                  ? 'bg-white text-emerald-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Building2 size={15} />
              <span>Rekap per Lokasi ({groupedByLocation.length})</span>
            </button>
            <button
              onClick={() => setViewMode('chronological')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'chronological'
                  ? 'bg-white text-emerald-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Clock size={15} />
              <span>Detail Sesi Distribusi ({filteredServings.length})</span>
            </button>
            <button
              onClick={() => setViewMode('kitchen_stock')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'kitchen_stock'
                  ? 'bg-white text-emerald-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Utensils size={15} />
              <span>Sisa Stok di Dapur</span>
            </button>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto text-xs text-slate-500">
            <span>Urutkan:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-medium text-slate-700 outline-none focus:ring-1 focus:ring-emerald-500"
            >
              <option value="oldest">Tertahan Paling Lama</option>
              <option value="most_unreturned">Sisa Terbanyak</option>
              <option value="newest">Tanggal Terbaru</option>
            </select>
          </div>
        </div>

        {/* Search & Filter Pills */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
          {/* Search Box */}
          <div className="md:col-span-5 relative">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Cari lokasi, kelas, asrama, atau menu..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3.5 py-2 bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Time Filter */}
          <div className="md:col-span-4 flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
            <span className="text-[11px] font-bold text-slate-400 shrink-0 uppercase tracking-tight">Kapan:</span>
            <button
              onClick={() => setTimeFilter('all')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold shrink-0 transition-all ${
                timeFilter === 'all'
                  ? 'bg-emerald-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Semua
            </button>
            <button
              onClick={() => setTimeFilter('today')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold shrink-0 transition-all ${
                timeFilter === 'today'
                  ? 'bg-emerald-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Hari Ini
            </button>
            <button
              onClick={() => setTimeFilter('yesterday')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold shrink-0 transition-all ${
                timeFilter === 'yesterday'
                  ? 'bg-emerald-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Kemarin
            </button>
            <button
              onClick={() => setTimeFilter('overdue')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold shrink-0 transition-all ${
                timeFilter === 'overdue'
                  ? 'bg-amber-600 text-white'
                  : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
              }`}
            >
              Terlambat
            </button>
          </div>

          {/* Status Filter */}
          <div className="md:col-span-3 flex items-center gap-1.5 justify-start md:justify-end">
            <span className="text-[11px] font-bold text-slate-400 shrink-0 uppercase tracking-tight">Status:</span>
            <button
              onClick={() => setStatusFilter('unreturned_only')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                statusFilter === 'unreturned_only'
                  ? 'bg-rose-700 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Ada Sisa
            </button>
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                statusFilter === 'all'
                  ? 'bg-slate-800 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Semua
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Areas */}
      {viewMode === 'grouped_location' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-500 px-1">
            <span className="font-semibold">
              Menampilkan {groupedByLocation.length} lokasi titik penerima
            </span>
            <span>Total {totalUnreturnedOverall} wadah belum kembali</span>
          </div>

          {groupedByLocation.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
              <CheckCircle2 size={48} className="mx-auto text-emerald-500 mb-3 opacity-80" />
              <h4 className="text-base font-bold text-slate-800">Semua Wadah Sudah Dikembalikan!</h4>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                Tidak ada sisa ompreng/wadah yang tertahan sesuai filter yang dipilih. Seluruh penerima telah mengembalikan ke dapur.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {groupedByLocation.map((loc, idx) => {
                const hasUnreturned = loc.totalUnreturned > 0;
                const pct = loc.totalGiven > 0 ? Math.round((loc.totalReturned / loc.totalGiven) * 100) : 100;
                
                return (
                  <div
                    key={loc.locationName + idx}
                    className={`bg-white rounded-2xl border transition-all duration-200 overflow-hidden shadow-sm hover:shadow-md ${
                      hasUnreturned
                        ? loc.totalUnreturned >= 10
                          ? 'border-red-200 ring-1 ring-red-100'
                          : 'border-amber-200'
                        : 'border-emerald-100'
                    }`}
                  >
                    {/* Location Header */}
                    <div className="p-5 border-b border-slate-100 flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                          hasUnreturned
                            ? 'bg-rose-50 text-rose-700 border border-rose-100'
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                        }`}>
                          <MapPin size={20} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-base font-bold text-slate-900 tracking-tight">
                              {loc.locationName}
                            </h4>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                              {loc.sessions.length} Sesi
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                            <Clock size={12} className="text-slate-400" />
                            <span>Rentang waktu: {loc.earliestDate} {loc.earliestDate !== loc.latestDate ? `s/d ${loc.latestDate}` : ''}</span>
                          </p>
                        </div>
                      </div>

                      {/* Remaining Badge */}
                      <div className="text-right shrink-0">
                        <div className={`inline-flex flex-col items-end px-3 py-1.5 rounded-xl border ${
                          hasUnreturned
                            ? 'bg-rose-50 border-rose-200 text-rose-800'
                            : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                        }`}>
                          <span className="text-[10px] font-bold uppercase tracking-wider">
                            {hasUnreturned ? 'Sisa Belum Kembali' : 'Status'}
                          </span>
                          <span className="text-lg font-black leading-tight">
                            {hasUnreturned ? `${loc.totalUnreturned} Wadah` : 'LUNAS'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Progress Bar & Numbers */}
                    <div className="px-5 py-3.5 bg-slate-50/70 border-b border-slate-100 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-4 text-slate-600 font-medium">
                        <span>Terbagi: <strong className="text-slate-900">{loc.totalGiven}</strong></span>
                        <span>Kembali: <strong className="text-emerald-700">{loc.totalReturned}</strong></span>
                        <span>Tertahan: <strong className={hasUnreturned ? 'text-rose-600' : 'text-slate-600'}>{loc.totalUnreturned}</strong></span>
                      </div>
                      <span className="text-[11px] font-bold text-slate-500">
                        {pct}% Terkumpul
                      </span>
                    </div>

                    {/* Sessions Breakdown */}
                    <div className="p-5 space-y-2.5">
                      <p className="text-[11px] font-bold text-slate-400 uppercase tracking-tight mb-1">
                        Rincian per Sesi / Waktu Pembagian:
                      </p>
                      {loc.sessions.map((sess) => (
                        <div
                          key={sess.id}
                          className="p-3 rounded-xl bg-slate-50 hover:bg-slate-100/70 border border-slate-200/60 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-slate-800">
                                {sess.date} • pk {sess.time} WIB
                              </span>
                              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${sess.timeInfo.badgeColor}`}>
                                {sess.timeInfo.urgencyText}
                              </span>
                            </div>
                            {sess.relatedDist?.menuDetails && (
                              <p className="text-[11px] text-slate-500 italic flex items-center gap-1">
                                <Utensils size={11} className="text-slate-400" />
                                <span>Menu: {sess.relatedDist.menuDetails}</span>
                              </p>
                            )}
                          </div>

                          <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-200/60">
                            <div className="text-right">
                              <div className="text-[11px] text-slate-500">
                                Bagi: <strong className="text-slate-800">{sess.given}</strong> | Retur: <strong className="text-emerald-600">{sess.returned}</strong>
                              </div>
                              <div className={`text-xs font-black ${sess.unreturned > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                                Sisa: {sess.unreturned} wadah
                              </div>
                            </div>

                            {sess.unreturned > 0 ? (
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleOpenReturnModal(sess)}
                                  className="px-2.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-[11px] font-bold shadow-xs active:scale-95 transition-all"
                                  title="Catat pengambilan/pengembalian wadah"
                                >
                                  Catat Retur
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleMarkAllReturned(sess)}
                                  className="px-2 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-[11px] font-bold transition-all"
                                  title="Tandai semua sisa sesi ini sudah lunas kembali"
                                >
                                  Lunas
                                </button>
                              </div>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-200">
                                <Check size={12} /> Selesai
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* View Mode: Chronological List */}
      {viewMode === 'chronological' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-tight flex items-center gap-2">
              <Clock size={15} className="text-emerald-700" />
              Daftar Sesi Pembagian & Sisa Belum Kembali
            </h4>
            <span className="text-xs text-slate-500 font-medium">
              {filteredServings.length} rekaman ditemukan
            </span>
          </div>

          {filteredServings.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
              <CheckCircle2 size={40} className="mx-auto text-emerald-400 mb-2 opacity-60" />
              <p className="text-sm font-semibold text-slate-700">Tidak ada sesi yang sesuai dengan kriteria</p>
              <p className="text-xs text-slate-400 mt-1">Coba ubah filter status atau rentang waktu di atas.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredServings.map((item) => (
                <div
                  key={item.id}
                  className="p-4 sm:p-5 hover:bg-slate-50/80 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  {/* Left: Location & Time details */}
                  <div className="flex items-start gap-3.5">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                      item.unreturned > 0
                        ? 'bg-rose-50 text-rose-700 border border-rose-100'
                        : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                    }`}>
                      <MapPin size={18} />
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-slate-900 tracking-tight">
                          {item.recipientName}
                        </span>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${item.timeInfo.badgeColor}`}>
                          {item.timeInfo.urgencyText}
                        </span>
                        {item.qualityControl && (
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                            QC: {item.qualityControl}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
                        <span className="flex items-center gap-1 font-medium text-slate-700">
                          <Calendar size={13} className="text-slate-400" />
                          {item.date} • {item.time} WIB
                        </span>
                        {item.relatedDist && (
                          <span className="flex items-center gap-1 italic text-slate-500">
                            <Utensils size={13} className="text-slate-400" />
                            Menu: {item.relatedDist.menuDetails}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Metrics & Actions */}
                  <div className="flex items-center justify-between md:justify-end gap-5 pl-13 md:pl-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100">
                    <div className="grid grid-cols-3 gap-3 text-center text-xs">
                      <div className="bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-100">
                        <span className="text-[10px] text-slate-400 block font-medium">Bagi</span>
                        <span className="font-bold text-slate-800 text-sm">{item.given}</span>
                      </div>
                      <div className="bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-100">
                        <span className="text-[10px] text-slate-400 block font-medium">Retur</span>
                        <span className="font-bold text-emerald-700 text-sm">{item.returned}</span>
                      </div>
                      <div className={`px-2.5 py-1.5 rounded-lg border ${
                        item.unreturned > 0
                          ? 'bg-rose-50 border-rose-200 text-rose-700'
                          : 'bg-emerald-50 border-emerald-200 text-emerald-700'
                      }`}>
                        <span className="text-[10px] block font-medium uppercase">Sisa</span>
                        <span className="font-black text-sm">{item.unreturned}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {item.unreturned > 0 ? (
                        <>
                          <button
                            type="button"
                            onClick={() => handleOpenReturnModal(item)}
                            className="px-3 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold shadow-xs active:scale-95 transition-all"
                          >
                            Catat Retur
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMarkAllReturned(item)}
                            className="px-2.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold transition-all"
                            title="Tandai semua sisa sudah kembali"
                          >
                            Lunas
                          </button>
                        </>
                      ) : (
                        <span className="text-xs font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl flex items-center gap-1">
                          <Check size={14} /> Lunas
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* View Mode: Kitchen Leftovers / Unserved Stock */}
      {viewMode === 'kitchen_stock' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100 bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h4 className="text-sm font-bold text-slate-800 tracking-tight flex items-center gap-2">
                <Utensils size={16} className="text-emerald-700" />
                Sisa Makanan di Dapur (Penerimaan vs Terbagi ke Siswa)
              </h4>
              <p className="text-xs text-slate-500 mt-0.5">
                Membandingkan jumlah porsi yang tiba dari vendor dapur dengan total porsi yang sudah disalurkan ke kelas/asrama.
              </p>
            </div>
            {onNavigateToPembagian && (
              <button
                onClick={onNavigateToPembagian}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-lg text-xs font-bold border border-emerald-200 transition-all self-start sm:self-auto"
              >
                <span>Input Pembagian Baru</span>
                <ChevronRight size={14} />
              </button>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-100/70 text-slate-500 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Tanggal & Menu</th>
                  <th className="py-3 px-3 text-center">Tiba dari Vendor</th>
                  <th className="py-3 px-3 text-center">Sudah Terbagi</th>
                  <th className="py-3 px-3 text-center text-amber-700">Sisa di Dapur</th>
                  <th className="py-3 px-3 text-center text-emerald-700">Wadah Kembali</th>
                  <th className="py-3 px-3 text-center text-rose-700">Wadah Tertahan</th>
                  <th className="py-3 px-4 text-center">Status Dapur</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {kitchenLeftovers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      Belum ada data distribusi dapur yang tercatat.
                    </td>
                  </tr>
                ) : (
                  kitchenLeftovers.map((row) => (
                    <tr key={row.date} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900">{row.date}</div>
                        <div className="text-[11px] text-slate-500 italic max-w-xs truncate">
                          {row.menus || 'Menu tidak tercatat'}
                        </div>
                        {row.officers && (
                          <div className="text-[10px] text-slate-400">Piket: {row.officers}</div>
                        )}
                      </td>
                      <td className="py-3.5 px-3 text-center font-bold text-slate-800">
                        {row.totalReceived}
                      </td>
                      <td className="py-3.5 px-3 text-center font-bold text-blue-700">
                        {row.totalServed}
                      </td>
                      <td className="py-3.5 px-3 text-center font-black text-amber-600">
                        {row.unservedStock > 0 ? (
                          <span className="bg-amber-50 text-amber-800 px-2 py-0.5 rounded-full border border-amber-200">
                            {row.unservedStock} porsi
                          </span>
                        ) : (
                          <span className="text-slate-400">0</span>
                        )}
                      </td>
                      <td className="py-3.5 px-3 text-center font-bold text-emerald-600">
                        {row.totalReturned}
                      </td>
                      <td className="py-3.5 px-3 text-center font-black text-rose-600">
                        {row.unreturnedContainers > 0 ? (
                          <span className="bg-rose-50 text-rose-800 px-2 py-0.5 rounded-full border border-rose-200">
                            {row.unreturnedContainers} wadah
                          </span>
                        ) : (
                          <span className="text-emerald-600 font-bold">Lunas</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        {row.unservedStock === 0 && row.unreturnedContainers === 0 ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                            <Check size={12} /> Selesai Penuh
                          </span>
                        ) : row.unservedStock > 0 ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
                            Ada Stok Belum Dibagi
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-700 bg-rose-50 px-2.5 py-1 rounded-full border border-rose-200">
                            Menunggu Wadah Kembali
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal: Quick Return Input */}
      {activeReturnServing && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-amber-50/50">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center">
                  <RotateCcw size={18} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Catat Pengembalian Wadah</h4>
                  <p className="text-[11px] text-slate-500">{activeReturnServing.recipientName}</p>
                </div>
              </div>
              <button
                onClick={() => setActiveReturnServing(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Location & Time info card */}
              <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200/80 text-xs space-y-1.5">
                <div className="flex justify-between text-slate-600">
                  <span>Lokasi Penerima:</span>
                  <strong className="text-slate-900">{activeReturnServing.recipientName}</strong>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Waktu Distribusi:</span>
                  <strong className="text-slate-900">{activeReturnServing.date} • {activeReturnServing.time}</strong>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Total Wadah Dibagikan:</span>
                  <strong className="text-blue-700">{activeReturnServing.amount} wadah</strong>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Sudah Dikembalikan:</span>
                  <strong className="text-emerald-700">{activeReturnServing.returnedAmount || 0} wadah</strong>
                </div>
                <div className="flex justify-between text-rose-700 font-bold pt-1.5 border-t border-slate-200">
                  <span>Sisa Belum Kembali:</span>
                  <span className="text-sm">{Math.max(0, (activeReturnServing.amount || 0) - (activeReturnServing.returnedAmount || 0))} wadah</span>
                </div>
              </div>

              {/* Input for additional return amount */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-tight mb-2">
                  Jumlah Wadah Yang Baru Dikembalikan:
                </label>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setAdditionalReturnQty(prev => Math.max(1, prev - 1))}
                    className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-lg flex items-center justify-center transition-all"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min="1"
                    max={Math.max(0, (activeReturnServing.amount || 0) - (activeReturnServing.returnedAmount || 0))}
                    value={additionalReturnQty}
                    onChange={(e) => setAdditionalReturnQty(Number(e.target.value))}
                    className="flex-1 py-2 text-center text-xl font-black text-slate-900 bg-white border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const maxPossible = Math.max(0, (activeReturnServing.amount || 0) - (activeReturnServing.returnedAmount || 0));
                      setAdditionalReturnQty(prev => Math.min(maxPossible, prev + 1));
                    }}
                    className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-lg flex items-center justify-center transition-all"
                  >
                    +
                  </button>
                </div>
                <div className="flex justify-between items-center mt-2">
                  <button
                    type="button"
                    onClick={() => {
                      const maxPossible = Math.max(0, (activeReturnServing.amount || 0) - (activeReturnServing.returnedAmount || 0));
                      setAdditionalReturnQty(maxPossible);
                    }}
                    className="text-[11px] font-bold text-amber-700 hover:underline"
                  >
                    Ambil Semua Sisa (Lunas)
                  </button>
                  <span className="text-[11px] text-slate-400">
                    Akumulasi: {(activeReturnServing.returnedAmount || 0) + additionalReturnQty} / {activeReturnServing.amount}
                  </span>
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setActiveReturnServing(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-200 transition-all"
                disabled={isUpdating}
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSaveReturn}
                disabled={isUpdating || additionalReturnQty <= 0}
                className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 transition-all shadow-md active:scale-95 flex items-center gap-2 disabled:opacity-50"
              >
                {isUpdating ? <RefreshCw size={14} className="animate-spin" /> : <Check size={14} />}
                <span>Simpan Pengembalian</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
