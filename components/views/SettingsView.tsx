import React from 'react';
import { ArrowLeftIcon, SaveIcon, RotateCcwIcon, DownloadIcon } from '../Icons';

interface SettingsViewProps {
  cardCount: number;
  lastBackupTime: number | null;
  onBackup: () => void;
  onRestore: () => void;
  onExportCSV: () => void;
  onBack: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ 
  cardCount, 
  lastBackupTime, 
  onBackup, 
  onRestore, 
  onExportCSV,
  onBack 
}) => {
  return (
    <>
      <header className="bg-white shadow-sm p-4 sticky top-0 z-20">
        <div className="flex justify-between items-center mb-2">
          <div className="flex items-center gap-2">
            <button 
              onClick={onBack}
              className="p-2 -ml-2 text-slate-600 hover:bg-slate-100 rounded-full"
            >
              <ArrowLeftIcon />
            </button>
            <span className="font-bold text-slate-800">設定</span>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 pb-24 no-scrollbar">
          <div className="space-y-6">
            {/* Status Card */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
              <h2 className="text-lg font-bold text-slate-900 mb-4">データ状況</h2>
              <div className="space-y-4">
                <div className="flex justify-between items-center border-b border-slate-50 pb-2">
                  <span className="text-slate-500 text-sm">登録済み名刺</span>
                  <span className="font-bold text-xl text-blue-600">{cardCount}<span className="text-sm text-slate-400 font-normal ml-1">枚</span></span>
                </div>
                <div className="flex justify-between items-center border-b border-slate-50 pb-2">
                  <span className="text-slate-500 text-sm">最終バックアップ</span>
                  <span className="text-sm font-medium text-slate-700">
                    {lastBackupTime ? new Date(lastBackupTime).toLocaleString() : '未実施'}
                  </span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  ※ 自動バックアップは24時間に1回、データ更新時に実行されます。
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-3">
              <button 
                onClick={onExportCSV}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-4 rounded-xl shadow-lg shadow-emerald-200 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
              >
                <DownloadIcon className="w-5 h-5" /> CSVエクスポート
              </button>

              <button 
                onClick={onBackup}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl shadow-lg shadow-blue-200 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
              >
                <SaveIcon className="w-5 h-5" /> 今すぐバックアップ
              </button>
              
              <button 
                onClick={onRestore}
                className="w-full bg-white hover:bg-slate-50 text-slate-700 font-bold py-4 rounded-xl border border-slate-200 shadow-sm active:scale-[0.98] transition-all flex items-center justify-center gap-2"
              >
                <RotateCcwIcon className="w-5 h-5" /> バックアップから復元
              </button>
            </div>
            
             <div className="bg-orange-50 p-4 rounded-xl border border-orange-100 text-xs text-orange-800 leading-relaxed">
               <strong>注意:</strong> 復元を行うと、現在アプリ内に保存されているデータはすべて削除され、バックアップ時点の内容で上書きされます。
             </div>
          </div>
      </div>
    </>
  );
};