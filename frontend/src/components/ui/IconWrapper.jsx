export default function IconWrapper({ icon: Icon, size = 18, className = "", iconClassName = "" }) {
  return (
    <div className={`flex items-center justify-center flex-shrink-0 ${className}`}>
      {Icon ? <Icon size={size} className={iconClassName} /> : null}
    </div>
  );
}
