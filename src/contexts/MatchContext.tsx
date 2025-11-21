import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';

interface SelectedMatch {
  matchId: string;
  homeTeam: string;
  awayTeam: string;
}

interface MatchContextType {
  selectedMatch: SelectedMatch | null;
  setSelectedMatch: (match: SelectedMatch | null) => void;
}

const MatchContext = createContext<MatchContextType | undefined>(undefined);

export function MatchProvider({ children }: { children: ReactNode }) {
  const [selectedMatch, setSelectedMatch] = useState<SelectedMatch | null>(null);

  return (
    <MatchContext.Provider value={{ selectedMatch, setSelectedMatch }}>
      {children}
    </MatchContext.Provider>
  );
}

export function useMatch() {
  const context = useContext(MatchContext);
  if (!context) {
    throw new Error('useMatch must be used within MatchProvider');
  }
  return context;
}
