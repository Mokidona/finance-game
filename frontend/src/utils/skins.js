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
