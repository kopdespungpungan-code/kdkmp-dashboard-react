export default function FlagIcon({ w = 28, h = 19, style }) {
  return (
    <svg className="flag-indo" width={w} height={h} viewBox="0 0 30 20" aria-hidden="true" style={style}>
      <rect width="30" height="10" fill="#ce1126" />
      <rect y="10" width="30" height="10" fill="#fff" />
    </svg>
  );
}
