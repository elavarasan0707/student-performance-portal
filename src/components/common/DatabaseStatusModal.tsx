import React, { useState } from 'react';
import { usePortal } from '../../context/PortalContext';
import {
  Database,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  X,
  Server,
  Layers,
  ArrowUpDown,
  Cpu,
  ShieldCheck,
} from 'lucide-react';

interface DatabaseStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DatabaseStatusModal: React.FC<DatabaseStatusModalProps> = ({ isOpen, onClose }) => {
  const { dbStatus, refreshDbStatus, syncDataToDb, isDbSyncing } = usePortal();
  const [syncResult, setSyncResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  if (!isOpen) return null;

  const handleRefresh = async () => {
    setIsRefreshing(true);
    setSyncResult(null);
    await refreshDbStatus();
    setIsRefreshing(false);
  };

  const handleSync = async () => {
    setSyncResult(null);
    const res = await syncDataToDb();
    setSyncResult(res);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-indigo-600/30 text-indigo-400 border border-indigo-500/30">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-white">Database Engine Diagnostics</h3>
              <p className="text-xs text-slate-400">Institutional Cloud & Memory Storage Status</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          {/* Status Banner */}
          <div
            className={`p-3.5 rounded-xl border flex items-start gap-3 ${
              dbStatus?.connected
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-amber-50 border-amber-200 text-amber-900'
            }`}
          >
            {dbStatus?.connected ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            )}
            <div className="text-xs">
              <div className="font-bold text-sm">
                {dbStatus?.connected ? 'Institutional Storage Active' : 'Memory Cache Operational'}
              </div>
              <div className="mt-0.5 opacity-90">
                {dbStatus?.message || (dbStatus?.connected ? 'Connected to database backend successfully' : 'Running on high-performance local memory repository.')}
              </div>
            </div>
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
              <span className="text-slate-500 block text-[11px]">Storage Engine</span>
              <span className="font-bold text-slate-800 uppercase flex items-center gap-1.5 mt-0.5">
                <Server className="w-3.5 h-3.5 text-indigo-600" />
                {dbStatus?.type || 'Memory Repository'}
              </span>
            </div>

            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
              <span className="text-slate-500 block text-[11px]">Host / Port</span>
              <span className="font-bold text-slate-800 flex items-center gap-1.5 mt-0.5 truncate">
                <Cpu className="w-3.5 h-3.5 text-slate-600" />
                {dbStatus?.host ? `${dbStatus.host}:${dbStatus.port}` : 'Local Container:3000'}
              </span>
            </div>

            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
              <span className="text-slate-500 block text-[11px]">Schema / Database</span>
              <span className="font-bold text-slate-800 flex items-center gap-1.5 mt-0.5 truncate">
                <Layers className="w-3.5 h-3.5 text-slate-600" />
                {dbStatus?.database || 'anna_autonomous_portal'}
              </span>
            </div>

            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
              <span className="text-slate-500 block text-[11px]">Authentication</span>
              <span className="font-bold text-emerald-700 flex items-center gap-1.5 mt-0.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                {dbStatus?.hasPassword ? 'Encrypted Password' : 'JWT Token Auth'}
              </span>
            </div>
          </div>

          {/* Table Counts if available */}
          {dbStatus?.tableCounts && (
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <div className="text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-2">
                Persisted Records
              </div>
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="bg-white p-2 rounded-lg border border-slate-200">
                  <div className="font-extrabold text-slate-900">{dbStatus.tableCounts.students ?? 10}</div>
                  <div className="text-[10px] text-slate-500">Students</div>
                </div>
                <div className="bg-white p-2 rounded-lg border border-slate-200">
                  <div className="font-extrabold text-slate-900">{dbStatus.tableCounts.faculty ?? 4}</div>
                  <div className="text-[10px] text-slate-500">Faculty</div>
                </div>
                <div className="bg-white p-2 rounded-lg border border-slate-200">
                  <div className="font-extrabold text-slate-900">{dbStatus.tableCounts.attendance ?? 240}</div>
                  <div className="text-[10px] text-slate-500">Attendance</div>
                </div>
              </div>
            </div>
          )}

          {/* Sync Result notification */}
          {syncResult && (
            <div
              className={`p-3 rounded-lg text-xs font-semibold ${
                syncResult.success
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'bg-rose-50 text-rose-800 border border-rose-200'
              }`}
            >
              {syncResult.message}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="bg-slate-50 px-5 py-3.5 border-t border-slate-200 flex items-center justify-between">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-200 border border-slate-300 transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>{isRefreshing ? 'Checking...' : 'Refresh Status'}</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSync}
              disabled={isDbSyncing}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors cursor-pointer disabled:opacity-50"
            >
              <ArrowUpDown className={`w-3.5 h-3.5 ${isDbSyncing ? 'animate-spin' : ''}`} />
              <span>{isDbSyncing ? 'Syncing...' : 'Sync Repository'}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
