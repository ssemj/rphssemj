import React, { useState } from 'react';
import { DEFAULT_GEMINI_MODEL } from '../services/geminiService';

interface SettingsProps {
  onBack: () => void;
}

const Settings: React.FC<SettingsProps> = ({ onBack }) => {
  const [geminiKey, setGeminiKey] = useState(() => localStorage.getItem('gemini_api_key') || '');
  const [geminiModel, setGeminiModel] = useState(() => localStorage.getItem('gemini_model') || '');

  const handleSave = () => {
    if (geminiKey.trim()) localStorage.setItem('gemini_api_key', geminiKey.trim()); else localStorage.removeItem('gemini_api_key');
    if (geminiModel.trim()) localStorage.setItem('gemini_model', geminiModel.trim()); else localStorage.removeItem('gemini_model');
    alert('Tetapan kunci API Gemini telah disimpan!');
    onBack();
  };

  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8">
      <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-lg p-8">
        <h1 className="text-2xl font-bold text-gray-800 mb-4">Tetapan</h1>

        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-700 mb-2">Kunci API Gemini</h2>
          <p className="text-sm text-gray-500 mb-4">
            Digunakan untuk membaca DSKP (PDF/Word), menjana Objektif, Aktiviti, BBM &amp; Refleksi eRPH, dan menukar teks ke Jawi.
          </p>
          <input
            type="password"
            value={geminiKey}
            onChange={(e) => setGeminiKey(e.target.value)}
            placeholder="AIza..."
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
          />
          <input
            type="text"
            value={geminiModel}
            onChange={(e) => setGeminiModel(e.target.value)}
            placeholder={`Model (kosongkan untuk lalai: ${DEFAULT_GEMINI_MODEL})`}
            className="w-full mt-2 px-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div className="mb-6 text-sm text-gray-600 bg-gray-50 p-4 rounded-lg">
          <h3 className="font-semibold mb-2">Bagaimana untuk mendapatkan Kunci API Gemini (percuma)?</h3>
          <ol className="list-decimal list-inside space-y-1">
            <li>Layari <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Google AI Studio</a>.</li>
            <li>Log masuk dengan akaun Google anda.</li>
            <li>Klik butang "Create API key".</li>
            <li>Salin kunci (bermula dengan <code>AIza</code>) dan tampalkan di ruangan di atas.</li>
          </ol>
        </div>

        <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 rounded-md" role="alert">
          <p className="font-bold">Peringatan Penting</p>
          <p>Jangan kongsikan Kunci API anda dengan sesiapa pun. Kunci ini adalah rahsia dan terikat dengan akaun anda.</p>
        </div>

        <div className="mt-8 flex justify-between items-center">
          <button
            onClick={onBack}
            className="px-6 py-2 bg-gray-200 text-gray-800 font-semibold rounded-lg hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2"
          >
            Kembali
          </button>
          <button
            onClick={handleSave}
            className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Simpan Tetapan
          </button>
        </div>
      </div>
    </div>
  );
};

export default Settings;
