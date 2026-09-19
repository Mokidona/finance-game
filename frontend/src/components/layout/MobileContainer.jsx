export default function MobileContainer({ children }) {
  return (
    <div className="min-h-screen w-full bg-black flex justify-center pt-[env(safe-area-inset-top)]">
      <div className="relative w-full max-w-[390px] min-h-screen bg-black pt-2">{children}</div>
    </div>
  );
}
