import { useEffect, useState } from 'react';

interface Props {
  photoUrl?: string | null;
  /** Shown when there is no photo, or the photo fails to load. */
  fallback: string;
  size?: number;
  className?: string;
}

/**
 * Player headshot with a real fallback.
 *
 * Photo coverage is incomplete and some published URLs 404 outright - a player
 * can have a code with no image behind it at any size. Hiding a broken image
 * leaves an empty circle, which looks like a loading bug; falling back to
 * initials looks deliberate. So a load failure switches to text rather than
 * removing the element.
 */
const PlayerAvatar = ({ photoUrl, fallback, size = 44, className = '' }: Props) => {
  const [failed, setFailed] = useState(false);

  // A new player in the same slot deserves a fresh attempt at their photo.
  useEffect(() => setFailed(false), [photoUrl]);

  const showPhoto = Boolean(photoUrl) && !failed;

  return (
    <span
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-[11px] font-semibold ${className}`}
      style={{ width: size, height: size }}
    >
      {showPhoto ? (
        <img
          src={photoUrl as string}
          alt=""
          loading="lazy"
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        fallback
      )}
    </span>
  );
};

export default PlayerAvatar;
