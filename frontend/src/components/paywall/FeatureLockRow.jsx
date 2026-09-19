export default function FeatureLockRow({ text }) {
  return (
    <div className="flex items-center gap-3 text-sm text-white">
      <Lock size={16} className="text-[#8E8E93] flex-shrink-0" />
      {text}
    </div>
  );
}
