interface LunitaEmblemProps {
  size?: number;
  className?: string;
  /** Si se omite, el emblema es decorativo. */
  title?: string;
}

/** Emblema institucional (luna y estrella) del sitio web Lunita. */
export function LunitaEmblem({ size = 40, className, title }: LunitaEmblemProps) {
  return (
    <svg
      viewBox="-8 -8 416 479"
      width={size}
      height={Math.round(size * (479 / 416))}
      className={className}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      xmlns="http://www.w3.org/2000/svg"
    >
      {title && <title>{title}</title>}
      <path d="M0.5 231.5A199.5 231 0 1 0 399.5 231.5A199.5 231 0 1 0 0.5 231.5Z" fill="#FECA0D" />
      <path d="M7 231.5A193 224.5 0 1 0 393 231.5A193 224.5 0 1 0 7 231.5Z" fill="#313293" />
      <path d="M15.6 248.8A165 189.8 0 1 0 345.6 248.8A165 189.8 0 1 0 15.6 248.8Z" fill="#FECA0D" />
      <path d="M21.4 248.8A159.2 183.8 0 1 0 339.8 248.8A159.2 183.8 0 1 0 21.4 248.8Z" fill="#FFFFFF" />
      <path
        d="M203 139.2A171.2 131.8 0 1 0 203 402.8A181.5 155.5 0 0 1 203 139.2Z"
        fill="#FECA0D"
        stroke="#313293"
        strokeWidth="4.8"
      />
      <path
        d="M235 84L239.82 98.97L255.54 98.93L242.8 108.13L247.7 123.07L235 113.8L222.3 123.07L227.2 108.13L214.46 98.93L230.18 98.97Z"
        fill="#FECA0D"
        stroke="#313293"
        strokeWidth="3.4"
      />
    </svg>
  );
}
