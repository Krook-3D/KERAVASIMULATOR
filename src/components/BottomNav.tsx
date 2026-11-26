export type PanelId = 'character' | 'skills' | 'inventory' | 'quests';

const TABS: { id: PanelId | null; label: string; icon: string }[] = [
  { id: null, label: 'Kartta', icon: '🗺️' },
  { id: 'character', label: 'Hahmo', icon: '🧍' },
  { id: 'skills', label: 'Skillit', icon: '📈' },
  { id: 'inventory', label: 'Reppu', icon: '🎒' },
  { id: 'quests', label: 'Questit', icon: '📜' },
];

interface BottomNavProps {
  active: PanelId | null;
  onSelect: (id: PanelId | null) => void;
}

export function BottomNav({ active, onSelect }: BottomNavProps) {
  return (
    <nav className="bottom-nav">
      {TABS.map((tab) => (
        <button
          key={tab.label}
          type="button"
          className={`bottom-nav__btn${active === tab.id ? ' is-active' : ''}`}
          onClick={() => onSelect(active === tab.id ? null : tab.id)}
        >
          <span className="bottom-nav__icon" aria-hidden="true">
            {tab.icon}
          </span>
          {tab.label}
        </button>
      ))}
    </nav>
  );
}
