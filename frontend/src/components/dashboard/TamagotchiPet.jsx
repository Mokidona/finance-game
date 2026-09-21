import { computePetHealth, petEmotion, petIsFainted } from "../../utils/petHealth.js";
import SlimeSprite from "../ui/SlimeSprite.jsx";

export default function TamagotchiPet({ availableBudget, dailyLimit, size = 120, slimeId = 1 }) {
  const health = computePetHealth({ availableBudget, dailyLimit });
  const fainted = petIsFainted(health);

  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      {/* Простая аура статуса */}
      <div
        className="absolute inset-3 rounded-full pointer-events-none transition-colors duration-500"
        style={{
          backgroundColor: fainted ? "rgba(255, 69, 58, 0.25)" : health.glow,
          filter: "blur(16px)",
        }}
      />

      <div
        className="relative z-10 cursor-pointer select-none"
        style={{ filter: fainted ? "grayscale(0.85) contrast(0.95)" : "none" }}
      >
        <SlimeSprite emotion={petEmotion(health.status)} slimeId={slimeId} size={size} />
      </div>
    </div>
  );
}
