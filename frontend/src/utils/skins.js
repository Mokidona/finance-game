// §35.3: связь скина Хранителя (backend `skins.py`) со спрайтом маскота.
//
// В паке слизней всего три персонажа (§28: Slime1/2/3), а скинов — пять, поэтому
// наряд из описаний («броня с неоновыми прожилками», «золотой костюм»)
// визуально передаётся выбором персонажа, а не отдельным артом. Когда появится
// отдельный арт под каждый скин, поменяется только эта таблица.
export const SKIN_SLIME = {
  skin_cadet: 1,
  skin_titan_guardian: 2,
  skin_ronin: 3,
  skin_architect: 2,
  skin_phantom_gold: 3,
};

export function slimeIdForSkin(skinId) {
  return SKIN_SLIME[skinId] ?? 1;
}
