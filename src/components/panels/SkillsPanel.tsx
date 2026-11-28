import type { Player } from '../../types/game';
import { SKILLS } from '../../data/skills';
import { levelFromXp, levelProgress, xpForLevel } from '../../game/xp/xp';
import { ProgressBar } from '../ProgressBar';

export function SkillsPanel({ player }: { player: Player }) {
  return (
    <ul className="skill-list">
      {SKILLS.map((skill) => {
        const xp = player.skills[skill.id]?.xp ?? 0;
        const level = levelFromXp(xp);
        return (
          <li key={skill.id} className="skill">
            <span className="skill__icon" aria-hidden="true">{skill.icon}</span>
            <div className="skill__main">
              <div className="stat__row">
                <strong>{skill.name}</strong>
                <span className="skill__level">Lv {level}</span>
              </div>
              <ProgressBar value={levelProgress(xp)} label={`${skill.name} XP`} />
              <div className="muted small">
                {xp} / {xpForLevel(level + 1)} XP · {skill.description}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
