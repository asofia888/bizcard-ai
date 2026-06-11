import React, { useState } from 'react';
import { ArrowLeftIcon, SaveIcon, RotateCcwIcon, DownloadIcon, CheckIcon } from '../Icons';
import { ACCESS_TOKEN_STORAGE_KEY } from '../../services/geminiService';
import { useDialog } from '../Dialog';

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
  const { showToast } = useDialog();
  const [accessToken, setAccessToken] = useState(
    () => localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY) ?? ''
  );

  const saveAccessToken = () => {
    localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, accessToken.trim());
    showToast('アクセストークンを保存しました。', 'success');
  };

  return (
    <>
      <header className="bg-white/80 backdrop-blur-md shadow-sm border-b border-slate-100 p-4 sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <button
            aria-label="戻る"
            onClick={onBack}
            className="p-2 -ml-2 text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
          >
            <ArrowLeftIcon />
          </button>
          <span className="font-extrabold text-slate-800">設定</span>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 pb-24 no-scrollbar">
        <div className="space-y-4">
          {/* Stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gradient-to-br from-brand-500 to-brand-700 rounded-2xl p-4 text-white shadow-lg shadow-brand-200">
              <p className="text-xs font-bold text-brand-100 uppercase tracking-wider mb-1">登録済み名刺</p>
              <p className="text-4xl font-extrabold leading-none">{cardCount}</p>
              <p className="text-brand-200 text-sm mt-1">枚</p>
            </div>
            <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">最終バックアップ</p>
              {lastBackupTime ? (
                <>
                  <p className="text-sm font-bold text-slate-800 leading-tight">
                    {new Date(lastBackupTime).toLocaleDateString('ja-JP')}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {new Date(lastBackupTime).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </>
              ) : (
                <p className="text-sm font-bold text-slate-400 mt-1">未実施</p>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-3">
            <button
              onClick={onExportCSV}
              className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-extrabold py-4 rounded-2xl shadow-lg shadow-emerald-200 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
            >
              <DownloadIcon className="w-5 h-5" /> CSVエクスポート
            </button>

            <button
              onClick={onBackup}
              className="w-full bg-gradient-to-r from-brand-500 to-brand-700 hover:from-brand-600 hover:to-brand-800 text-white font-extrabold py-4 rounded-2xl shadow-lg shadow-brand-200 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
            >
              <SaveIcon className="w-5 h-5" /> 今すぐバックアップ
            </button>

            <button
              onClick={onRestore}
              className="w-full bg-white hover:bg-slate-50 text-slate-700 font-bold py-4 rounded-2xl border border-slate-200 shadow-sm active:scale-[0.98] transition-all flex items-center justify-center gap-2"
            >
              <RotateCcwIcon className="w-5 h-5" /> バックアップから復元
            </button>
          </div>

          <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100 text-xs text-amber-800 leading-relaxed">
            <strong>注意:</strong> 復元を行うと、現在アプリ内に保存されているデータはすべて削除され、バックアップ時点の内容で上書きされます。
          </div>

          {/* AI解析のアクセストークン */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 space-y-3">
            <div>
              <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1.5">
                AI解析アクセストークン
              </label>
              <input
                type="password"
                value={accessToken}
                onChange={(e) => setAccessToken(e.target.value)}
                placeholder="サーバーに設定したトークンを入力"
                autoComplete="off"
                className="w-full bg-slate-100 px-3 py-2.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-400 focus:bg-white transition-all text-sm placeholder-slate-400"
              />
            </div>
            <button
              onClick={saveAccessToken}
              className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold py-3 rounded-xl active:scale-[0.98] transition-all flex items-center justify-center gap-2 text-sm"
            >
              <CheckIcon className="w-4 h-4" /> トークンを保存
            </button>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              AI解析を利用するための合言葉です。サーバーの APP_ACCESS_TOKEN と同じ値を一度入力すれば、この端末に保存されます。
            </p>
          </div>

          <div className="text-center pt-2">
            <p className="text-xs text-slate-300 font-medium">BizCard AI</p>
            <p className="text-[10px] text-slate-300 mt-0.5">Powered by Google Gemini</p>
          </div>
        </div>
      </div>
    </>
  );
};
