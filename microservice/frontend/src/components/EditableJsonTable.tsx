import React, { useState, useEffect } from 'react';
import { Save, CheckCircle2, Edit2 } from 'lucide-react';

interface EditableJsonTableProps {
  initialData: any[];
  onSave: (newDataStr: string) => void;
}

export function EditableJsonTable({ initialData, onSave }: EditableJsonTableProps) {
  const [data, setData] = useState<any[]>(initialData);
  const [isEditing, setIsEditing] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setData(initialData);
  }, [initialData]);

  if (!data || data.length === 0 || typeof data[0] !== 'object') {
    return null;
  }

  const keys = Object.keys(data[0]);

  const handleCellChange = (rowIndex: number, key: string, value: string) => {
    const newData = [...data];
    newData[rowIndex] = { ...newData[rowIndex], [key]: value };
    setData(newData);
    setSaved(false);
  };

  const handleSave = () => {
    onSave(JSON.stringify(data, null, 2));
    setIsEditing(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="mt-4 bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm relative">
      <div className="flex justify-between items-center bg-slate-50 border-b border-slate-200 px-3 py-2">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Extracted Data</span>
        <div className="flex gap-2">
          {!isEditing ? (
            <button 
              onClick={() => setIsEditing(true)}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-md hover:bg-slate-50 transition-colors"
            >
              <Edit2 className="w-3.5 h-3.5" />
              Edit Data
            </button>
          ) : (
            <button 
              onClick={handleSave}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors shadow-sm"
            >
              <Save className="w-3.5 h-3.5" />
              Save Changes
            </button>
          )}
          {saved && (
            <span className="flex items-center gap-1 text-xs text-green-600 font-medium animate-pulse">
              <CheckCircle2 className="w-4 h-4" />
              Saved
            </span>
          )}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50/50 border-b border-slate-100">
            <tr>
              {keys.map(k => (
                <th key={k} className="px-3 py-2 font-semibold text-slate-600 uppercase tracking-wider whitespace-nowrap">
                  {k}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.map((row: any, i: number) => (
              <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                {keys.map((k) => (
                  <td key={k} className="px-0 py-0">
                    {isEditing ? (
                      <input
                        type="text"
                        value={row[k] || ''}
                        onChange={(e) => handleCellChange(i, k, e.target.value)}
                        className="w-full h-full px-3 py-2 bg-blue-50/30 border-none outline-none focus:ring-1 focus:ring-blue-500 text-slate-700 text-xs"
                      />
                    ) : (
                      <div className="px-3 py-2 text-slate-600 max-w-[200px] truncate" title={String(row[k] || '')}>
                        {String(row[k] || '')}
                      </div>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
