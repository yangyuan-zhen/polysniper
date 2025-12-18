import { X, Users } from 'lucide-react';
import type { TeamInjuries } from '../types';

interface TeamInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  homeTeam: string;
  awayTeam: string;
  homeInjuries: TeamInjuries | null;
  awayInjuries: TeamInjuries | null;
}

export function TeamInfoModal({
  isOpen,
  onClose,
  homeTeam,
  awayTeam,
  homeInjuries,
  awayInjuries,
}: TeamInfoModalProps) {
  if (!isOpen) return null;

  const renderInjuries = (injuries: TeamInjuries | null) => {
    if (!injuries) {
      return null;
    }

    if (injuries.injuries.length === 0) {
      return <div className="text-green-400 text-sm">✓ 无伤病报告</div>;
    }

    return (
      <div className="space-y-2">
        {injuries.injuries.map((injury, idx) => (
          <div key={idx} className="bg-white/5 rounded-lg p-3 flex items-start gap-3">
            {injury.headshot && (
              <img
                src={injury.headshot}
                alt={injury.athleteName}
                className="w-12 h-12 rounded-full object-cover"
              />
            )}
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-white">{injury.athleteName}</span>
                {injury.jersey && (
                  <span className="text-xs text-gray-400">#{injury.jersey}</span>
                )}
                {injury.position && (
                  <span className="text-xs px-1.5 py-0.5 bg-purple-500/20 text-purple-300 rounded">
                    {injury.position}
                  </span>
                )}
              </div>
              <div className="mt-1">
                <span
                  className={`text-xs px-2 py-0.5 rounded ${
                    injury.status === 'Out'
                      ? 'bg-red-500/20 text-red-400'
                      : injury.status === 'Doubtful'
                      ? 'bg-orange-500/20 text-orange-400'
                      : 'bg-yellow-500/20 text-yellow-400'
                  }`}
                >
                  {injury.status}
                </span>
                {injury.details && (
                  <span className="text-xs text-gray-400 ml-2">{injury.details}</span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-[#1a1d2d] rounded-2xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden m-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <h2 className="text-2xl font-bold text-white">
            {homeTeam} vs {awayTeam}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="w-6 h-6 text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(90vh-80px)]">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-6">
            {/* Home Team */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Users className="w-5 h-5 text-blue-400" />
                <h3 className="text-xl font-bold text-white">{homeTeam}</h3>
              </div>

              {/* Injuries */}
              <div className="bg-white/5 rounded-lg p-4">
                <h4 className="font-semibold text-white mb-3">🏥 伤病名单</h4>
                {renderInjuries(homeInjuries)}
              </div>
            </div>

            {/* Away Team */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Users className="w-5 h-5 text-red-400" />
                <h3 className="text-xl font-bold text-white">{awayTeam}</h3>
              </div>

              {/* Injuries */}
              <div className="bg-white/5 rounded-lg p-4">
                <h4 className="font-semibold text-white mb-3">🏥 伤病名单</h4>
                {renderInjuries(awayInjuries)}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
