export default function Image({
  src,
  fill,
  priority,
  unoptimized,
  quality,
  loader,
  ...props
}: any) {
  return <img {...props} src={typeof src === "string" ? src : src.src} />;
}
