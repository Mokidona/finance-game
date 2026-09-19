export default function MobileContainer({ children }) {
  return (
    <div className="min-h-screen w-full bg-black flex justify-center">
      <div className="relative w-full max-w-[390px] min-h-screen bg-black">{children}</div>
    </div>
  );
}
